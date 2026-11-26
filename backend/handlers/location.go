package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"

	"geotrack/geo"
	"geotrack/models"
)

// geofenceRow is an internal struct for geofence data used in checks
type geofenceRow struct {
	ID          string
	Name        string
	Coordinates [][2]float64
	Category    string
}

// UpdateLocation handles POST /vehicles/location
// This is the core endpoint: stores GPS, detects geofence transitions,
// generates alerts asynchronously.
func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		VehicleID string  `json:"vehicle_id"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if !h.decodeJSON(w, r, &req) {
		return
	}

	// Validate fields
	if req.VehicleID == "" {
		h.respondError(w, http.StatusBadRequest, "vehicle_id is required", start)
		return
	}
	if !isUUID(req.VehicleID) {
		h.respondError(w, http.StatusBadRequest, "vehicle_id must be a valid UUID", start)
		return
	}
	if err := validateLatLng(req.Latitude, req.Longitude); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	// Verify vehicle exists
	var vehicle models.Vehicle
	err := h.DB.QueryRow(`
		SELECT id, vehicle_number, driver_name, vehicle_type FROM vehicles WHERE id = $1
	`, req.VehicleID).Scan(&vehicle.ID, &vehicle.VehicleNumber, &vehicle.DriverName, &vehicle.VehicleType)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	}
	if err != nil {
		h.serverError(w, "verify vehicle", err)
		return
	}

	// Get previous location (before inserting new one)
	var prevLat, prevLng float64
	var prevTime time.Time
	var hasPrev bool
	err = h.DB.QueryRow(`
		SELECT latitude, longitude, timestamp FROM vehicle_locations
		WHERE vehicle_id = $1 ORDER BY timestamp DESC LIMIT 1
	`, req.VehicleID).Scan(&prevLat, &prevLng, &prevTime)
	if err == nil {
		hasPrev = true
	}

	// Store the new location
	var locID string
	var locTimestamp time.Time
	err = h.DB.QueryRow(`
		INSERT INTO vehicle_locations (vehicle_id, latitude, longitude)
		VALUES ($1, $2, $3)
		RETURNING id, timestamp
	`, req.VehicleID, req.Latitude, req.Longitude).Scan(&locID, &locTimestamp)
	if err != nil {
		h.serverError(w, "store location", err)
		return
	}

	// Speed check (previous point -> new point)
	if hasPrev {
		go h.checkSpeedViolation(vehicle, req.Latitude, req.Longitude, prevLat, prevLng, locTimestamp.Sub(prevTime).Seconds())
	}

	// Fetch all geofences for transition check
	gfRows, err := h.DB.Query(`SELECT id, name, coordinates, category FROM geofences`)
	if err != nil {
		log.Printf("Warning: could not fetch geofences: %v", err)
		hasPrev = false // skip transition check
	}

	var geofences []geofenceRow
	if gfRows != nil {
		defer gfRows.Close()
		for gfRows.Next() {
			var gf geofenceRow
			var coordsRaw []byte
			if err := gfRows.Scan(&gf.ID, &gf.Name, &coordsRaw, &gf.Category); err != nil {
				continue
			}
			json.Unmarshal(coordsRaw, &gf.Coordinates)
			geofences = append(geofences, gf)
		}
	}

	// Asynchronously detect transitions and broadcast alerts
	// (non-blocking so the HTTP response is returned immediately)
	if hasPrev && len(geofences) > 0 {
		go h.processGeofenceTransitions(vehicle, req.Latitude, req.Longitude, prevLat, prevLng, geofences)
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"message":     "Location updated successfully",
		"vehicle_id":  vehicle.ID,
		"latitude":    req.Latitude,
		"longitude":   req.Longitude,
		"timestamp":   locTimestamp,
		"location_id": locID,
	}, start)
}

const (
	speedLimitKmh      = 80.0
	maxPlausibleKmh    = 250.0            // above this = GPS jump, ignored
	minSpeedSampleSecs = 2.0              // min dt between points for a speed reading
	speedAlertCooldown = 60 * time.Second // min gap between speed alerts per vehicle
)

// lastSpeedAlert tracks the last speed alert time per vehicle (in-memory).
var (
	speedAlertMu   sync.Mutex
	lastSpeedAlert = map[string]time.Time{}
)

// haversineMeters returns the great-circle distance between two points in meters.
func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return earthRadius * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// speedKmh converts a distance in meters covered in the given seconds to km/h.
func speedKmh(meters, seconds float64) float64 {
	return meters / seconds * 3.6
}

// checkSpeedViolation runs in a goroutine. If the speed between the previous and
// new position exceeds speedLimitKmh, it stores a 'speed_violation' and broadcasts it.
func (h *Handler) checkSpeedViolation(vehicle models.Vehicle, newLat, newLng, prevLat, prevLng, seconds float64) {
	// Too-close samples give unreliable speeds
	if seconds < minSpeedSampleSecs {
		return
	}
	meters := haversineMeters(prevLat, prevLng, newLat, newLng)
	speed := speedKmh(meters, seconds)
	log.Printf("Speed check: vehicle=%s distance=%.1fm dt=%.2fs speed=%.1f km/h", vehicle.VehicleNumber, meters, seconds, speed)
	if speed <= speedLimitKmh {
		return
	}
	// Implausible speed = GPS jump / simulator teleport, not a real violation
	if speed > maxPlausibleKmh {
		log.Printf("Ignoring implausible speed %.1f km/h for vehicle=%s (GPS jump)", speed, vehicle.VehicleNumber)
		return
	}

	// Per-vehicle cooldown: reserve the slot atomically before inserting
	speedAlertMu.Lock()
	prevAlert, hadPrev := lastSpeedAlert[vehicle.ID]
	if hadPrev && time.Since(prevAlert) < speedAlertCooldown {
		speedAlertMu.Unlock()
		return
	}
	lastSpeedAlert[vehicle.ID] = time.Now()
	speedAlertMu.Unlock()

	var violationID string
	var violationTime time.Time
	err := h.DB.QueryRow(`
		INSERT INTO violations (vehicle_id, geofence_id, event_type, latitude, longitude)
		VALUES ($1, NULL, 'speed_violation', $2, $3)
		RETURNING id, timestamp
	`, vehicle.ID, newLat, newLng).Scan(&violationID, &violationTime)
	if err != nil {
		log.Printf("Failed to store speed violation: %v", err)
		// release the reserved slot so a later sample can retry
		speedAlertMu.Lock()
		if hadPrev {
			lastSpeedAlert[vehicle.ID] = prevAlert
		} else {
			delete(lastSpeedAlert, vehicle.ID)
		}
		speedAlertMu.Unlock()
		return
	}

	log.Printf("🚨 speed_violation: vehicle=%s speed=%.1f km/h", vehicle.VehicleNumber, speed)

	eventJSON, err := json.Marshal(models.AlertEvent{
		EventID:       "evt_" + violationID,
		EventType:     "speed_violation",
		Timestamp:     violationTime,
		VehicleID:     vehicle.ID,
		VehicleNumber: vehicle.VehicleNumber,
		DriverName:    vehicle.DriverName,
		Latitude:      newLat,
		Longitude:     newLng,
		GeofenceName:  nil,
		SpeedKmh:      &speed,
		Vehicle: models.VehicleInfo{
			VehicleID:     vehicle.ID,
			VehicleNumber: vehicle.VehicleNumber,
			DriverName:    vehicle.DriverName,
		},
		Location: models.LocationInfo{Latitude: newLat, Longitude: newLng},
	})
	if err != nil {
		log.Printf("Failed to marshal speed alert: %v", err)
		return
	}
	h.Hub.Broadcast(eventJSON)
}

// processGeofenceTransitions runs in a goroutine.
// It compares previous and current vehicle positions against every geofence
// and fires alerts on state changes.
func (h *Handler) processGeofenceTransitions(
	vehicle models.Vehicle,
	newLat, newLng float64,
	prevLat, prevLng float64,
	geofences []geofenceRow,
) {
	for _, gf := range geofences {
		wasInside := geo.PointInPolygon(prevLat, prevLng, gf.Coordinates)
		isInside := geo.PointInPolygon(newLat, newLng, gf.Coordinates)

		eventType := geo.GeofenceStatus(wasInside, isInside)
		if eventType == "" {
			continue // No state change — skip
		}

		// Store the violation (always, regardless of alert rules)
		var violationID string
		var violationTime time.Time
		err := h.DB.QueryRow(`
			INSERT INTO violations (vehicle_id, geofence_id, event_type, latitude, longitude)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, timestamp
		`, vehicle.ID, gf.ID, eventType, newLat, newLng).Scan(&violationID, &violationTime)
		if err != nil {
			log.Printf("Failed to store violation: %v", err)
			continue
		}

		log.Printf("🚨 %s event: vehicle=%s geofence=%s", eventType, vehicle.VehicleNumber, gf.Name)

		// Check if any alert rule matches this geofence + vehicle + event
		// (only decides whether to broadcast the WebSocket event)
		var alertID string
		err = h.DB.QueryRow(`
			SELECT id FROM alert_rules
			WHERE geofence_id = $1
			  AND (vehicle_id = $2 OR vehicle_id IS NULL)
			  AND (event_type = $3 OR event_type = 'both')
			LIMIT 1
		`, gf.ID, vehicle.ID, eventType).Scan(&alertID)

		if err == sql.ErrNoRows {
			continue // No matching alert rule — violation stored, no broadcast
		}
		if err != nil {
			log.Printf("Alert rule query error: %v", err)
			continue
		}

		// Build and broadcast the WebSocket alert event
		gfName := gf.Name
		event := models.AlertEvent{
			EventID:       "evt_" + violationID,
			EventType:     eventType,
			Timestamp:     violationTime,
			VehicleID:     vehicle.ID,
			VehicleNumber: vehicle.VehicleNumber,
			DriverName:    vehicle.DriverName,
			Latitude:      newLat,
			Longitude:     newLng,
			GeofenceName:  &gfName,
			Vehicle: models.VehicleInfo{
				VehicleID:     vehicle.ID,
				VehicleNumber: vehicle.VehicleNumber,
				DriverName:    vehicle.DriverName,
			},
			Geofence: models.GeofenceInfo{
				GeofenceID:   gf.ID,
				GeofenceName: gf.Name,
				Category:     gf.Category,
			},
			Location: models.LocationInfo{
				Latitude:  newLat,
				Longitude: newLng,
			},
		}

		eventJSON, err := json.Marshal(event)
		if err != nil {
			log.Printf("Failed to marshal alert event: %v", err)
			continue
		}

		h.Hub.Broadcast(eventJSON)
	}
}

// GetLocation handles GET /vehicles/location/{vehicle_id}
func (h *Handler) GetLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vehicleID := mux.Vars(r)["vehicle_id"]
	if !isUUID(vehicleID) {
		h.respondError(w, http.StatusBadRequest, "vehicle_id must be a valid UUID", start)
		return
	}

	// Verify vehicle exists
	var vehicle models.Vehicle
	err := h.DB.QueryRow(`
		SELECT id, vehicle_number, driver_name, vehicle_type, phone_number, created_at, updated_at
		FROM vehicles WHERE id = $1
	`, vehicleID).Scan(&vehicle.ID, &vehicle.VehicleNumber, &vehicle.DriverName,
		&vehicle.VehicleType, &vehicle.PhoneNumber, &vehicle.CreatedAt, &vehicle.UpdatedAt)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	}
	if err != nil {
		h.serverError(w, "fetch vehicle", err)
		return
	}

	// Get latest location
	var loc models.VehicleLocation
	err = h.DB.QueryRow(`
		SELECT id, vehicle_id, latitude, longitude, timestamp
		FROM vehicle_locations
		WHERE vehicle_id = $1
		ORDER BY timestamp DESC LIMIT 1
	`, vehicleID).Scan(&loc.ID, &loc.VehicleID, &loc.Latitude, &loc.Longitude, &loc.Timestamp)
	if err == sql.ErrNoRows {
		h.respond(w, http.StatusOK, map[string]interface{}{
			"vehicle":          vehicle,
			"current_location": nil,
			"inside_geofences": []interface{}{},
		}, start)
		return
	}
	if err != nil {
		h.serverError(w, "fetch location", err)
		return
	}

	// Determine which geofences the vehicle is currently inside
	gfRows, err := h.DB.Query(`SELECT id, name, coordinates, category FROM geofences`)
	insideGeofences := []map[string]string{}
	if err == nil {
		defer gfRows.Close()
		for gfRows.Next() {
			var gf geofenceRow
			var coordsRaw []byte
			if err := gfRows.Scan(&gf.ID, &gf.Name, &coordsRaw, &gf.Category); err != nil {
				continue
			}
			json.Unmarshal(coordsRaw, &gf.Coordinates)
			if geo.PointInPolygon(loc.Latitude, loc.Longitude, gf.Coordinates) {
				insideGeofences = append(insideGeofences, map[string]string{
					"geofence_id":   gf.ID,
					"geofence_name": gf.Name,
					"category":      gf.Category,
				})
			}
		}
	}

	// Recent position history (oldest -> newest) for route playback
	history := []map[string]interface{}{}
	if hRows, err := h.DB.Query(`
		SELECT latitude, longitude, timestamp FROM vehicle_locations
		WHERE vehicle_id = $1 ORDER BY timestamp DESC LIMIT 100
	`, vehicleID); err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var lat, lng float64
			var ts time.Time
			if err := hRows.Scan(&lat, &lng, &ts); err != nil {
				continue
			}
			history = append([]map[string]interface{}{{"latitude": lat, "longitude": lng, "timestamp": ts}}, history...)
		}
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"vehicle":          vehicle,
		"current_location": loc,
		"inside_geofences": insideGeofences,
		"geofence_count":   len(insideGeofences),
		"history":          history,
	}, start)
}
