package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}

	// Validate fields
	if req.VehicleID == "" {
		h.respondError(w, http.StatusBadRequest, "vehicle_id is required", start)
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		h.respondError(w, http.StatusBadRequest, "latitude must be between -90 and 90", start)
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		h.respondError(w, http.StatusBadRequest, "longitude must be between -180 and 180", start)
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
		h.respondError(w, http.StatusInternalServerError, "Failed to verify vehicle", start)
		return
	}

	// Get previous location (before inserting new one)
	var prevLat, prevLng float64
	var hasPrev bool
	err = h.DB.QueryRow(`
		SELECT latitude, longitude FROM vehicle_locations
		WHERE vehicle_id = $1 ORDER BY timestamp DESC LIMIT 1
	`, req.VehicleID).Scan(&prevLat, &prevLng)
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
		h.respondError(w, http.StatusInternalServerError, "Failed to store location", start)
		return
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

		// Check if any alert rule matches this geofence + vehicle + event
		var alertID string
		err := h.DB.QueryRow(`
			SELECT id FROM alert_rules
			WHERE geofence_id = $1
			  AND (vehicle_id = $2 OR vehicle_id IS NULL)
			  AND (event_type = $3 OR event_type = 'both')
			LIMIT 1
		`, gf.ID, vehicle.ID, eventType).Scan(&alertID)

		if err == sql.ErrNoRows {
			continue // No matching alert rule
		}
		if err != nil {
			log.Printf("Alert rule query error: %v", err)
			continue
		}

		// Store the violation
		var violationID string
		var violationTime time.Time
		err = h.DB.QueryRow(`
			INSERT INTO violations (vehicle_id, geofence_id, event_type, latitude, longitude)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, timestamp
		`, vehicle.ID, gf.ID, eventType, newLat, newLng).Scan(&violationID, &violationTime)
		if err != nil {
			log.Printf("Failed to store violation: %v", err)
			continue
		}

		log.Printf("🚨 %s event: vehicle=%s geofence=%s", eventType, vehicle.VehicleNumber, gf.Name)

		// Build and broadcast the WebSocket alert event
		event := models.AlertEvent{
			EventID:   "evt_" + violationID,
			EventType: eventType,
			Timestamp: violationTime,
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
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch vehicle", start)
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
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch location", start)
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

	h.respond(w, http.StatusOK, map[string]interface{}{
		"vehicle":          vehicle,
		"current_location": loc,
		"inside_geofences": insideGeofences,
		"geofence_count":   len(insideGeofences),
	}, start)
}
