package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"geotrack/models"
)

// ConfigureAlert handles POST /alerts/configure
func (h *Handler) ConfigureAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		GeofenceID string  `json:"geofence_id"`
		VehicleID  *string `json:"vehicle_id"`
		EventType  string  `json:"event_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}

	if strings.TrimSpace(req.GeofenceID) == "" {
		h.respondError(w, http.StatusBadRequest, "geofence_id is required", start)
		return
	}
	if req.EventType != "entry" && req.EventType != "exit" && req.EventType != "both" {
		h.respondError(w, http.StatusBadRequest, "event_type must be 'entry', 'exit', or 'both'", start)
		return
	}

	var gfID string
	err := h.DB.QueryRow(`SELECT id FROM geofences WHERE id = $1`, req.GeofenceID).Scan(&gfID)
	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Geofence not found", start)
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to verify geofence", start)
		return
	}

	if req.VehicleID != nil && strings.TrimSpace(*req.VehicleID) != "" {
		var vID string
		err := h.DB.QueryRow(`SELECT id FROM vehicles WHERE id = $1`, *req.VehicleID).Scan(&vID)
		if err == sql.ErrNoRows {
			h.respondError(w, http.StatusNotFound, "Vehicle not found", start)
			return
		}
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to verify vehicle", start)
			return
		}
	} else {
		req.VehicleID = nil
	}

	var rule models.AlertRule
	var vehicleIDScan sql.NullString
	err = h.DB.QueryRow(`
		INSERT INTO alert_rules (geofence_id, vehicle_id, event_type)
		VALUES ($1, $2, $3)
		RETURNING id, geofence_id, vehicle_id, event_type, created_at
	`, req.GeofenceID, req.VehicleID, req.EventType).
		Scan(&rule.ID, &rule.GeofenceID, &vehicleIDScan, &rule.EventType, &rule.CreatedAt)

	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to configure alert: "+err.Error(), start)
		return
	}

	if vehicleIDScan.Valid {
		rule.VehicleID = &vehicleIDScan.String
	}

	h.respond(w, http.StatusCreated, map[string]interface{}{
		"message":    "Alert rule configured successfully",
		"alert_rule": rule,
	}, start)
}

// ListAlerts handles GET /alerts
func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	geofenceID := r.URL.Query().Get("geofence_id")
	vehicleID := r.URL.Query().Get("vehicle_id")

	query := `
		SELECT ar.id, ar.geofence_id, ar.vehicle_id, ar.event_type, ar.created_at,
		       g.name AS geofence_name, g.category,
		       v.vehicle_number, v.driver_name
		FROM alert_rules ar
		JOIN geofences g ON g.id = ar.geofence_id
		LEFT JOIN vehicles v ON v.id = ar.vehicle_id
		WHERE 1=1`

	args := []interface{}{}
	idx := 1

	if geofenceID != "" {
		query += fmt.Sprintf(" AND ar.geofence_id = $%d", idx)
		args = append(args, geofenceID)
		idx++
	}
	if vehicleID != "" {
		query += fmt.Sprintf(" AND ar.vehicle_id = $%d", idx)
		args = append(args, vehicleID)
		idx++
	}
	query += " ORDER BY ar.created_at DESC"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch alerts", start)
		return
	}
	defer rows.Close()

	type AlertWithDetails struct {
		models.AlertRule
		GeofenceName  string  `json:"geofence_name"`
		Category      string  `json:"category"`
		VehicleNumber *string `json:"vehicle_number,omitempty"`
		DriverName    *string `json:"driver_name,omitempty"`
	}

	alerts := []AlertWithDetails{}
	for rows.Next() {
		var a AlertWithDetails
		var vehicleIDScan, vehicleNum, driverName sql.NullString
		if err := rows.Scan(
			&a.ID, &a.GeofenceID, &vehicleIDScan, &a.EventType, &a.CreatedAt,
			&a.GeofenceName, &a.Category,
			&vehicleNum, &driverName,
		); err != nil {
			continue
		}
		if vehicleIDScan.Valid {
			a.VehicleID = &vehicleIDScan.String
		}
		if vehicleNum.Valid {
			a.VehicleNumber = &vehicleNum.String
		}
		if driverName.Valid {
			a.DriverName = &driverName.String
		}
		alerts = append(alerts, a)
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"alert_rules": alerts,
		"count":       len(alerts),
	}, start)
}
