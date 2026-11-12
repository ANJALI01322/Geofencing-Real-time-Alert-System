package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// GetViolations handles GET /violations/history
func (h *Handler) GetViolations(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	q := r.URL.Query()
	vehicleID  := q.Get("vehicle_id")
	geofenceID := q.Get("geofence_id")
	eventType  := q.Get("event_type")
	startDate  := q.Get("start_date")
	endDate    := q.Get("end_date")
	limitStr   := q.Get("limit")

	limit := 50
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil {
			if n > 500 { n = 500 }
			if n < 1  { n = 1  }
			limit = n
		}
	}

	query := `
		SELECT
			v.id, v.vehicle_id, v.geofence_id, v.event_type,
			v.latitude, v.longitude, v.timestamp,
			vh.vehicle_number, vh.driver_name, vh.vehicle_type,
			g.name AS geofence_name, g.category
		FROM violations v
		JOIN vehicles  vh ON vh.id = v.vehicle_id
		JOIN geofences g  ON g.id  = v.geofence_id
		WHERE 1=1`

	args := []interface{}{}
	idx := 1

	if vehicleID != "" {
		query += fmt.Sprintf(" AND v.vehicle_id = $%d", idx)
		args = append(args, vehicleID)
		idx++
	}
	if geofenceID != "" {
		query += fmt.Sprintf(" AND v.geofence_id = $%d", idx)
		args = append(args, geofenceID)
		idx++
	}
	if eventType != "" && (eventType == "entry" || eventType == "exit") {
		query += fmt.Sprintf(" AND v.event_type = $%d", idx)
		args = append(args, eventType)
		idx++
	}
	if startDate != "" {
		query += fmt.Sprintf(" AND v.timestamp >= $%d", idx)
		args = append(args, startDate)
		idx++
	}
	if endDate != "" {
		query += fmt.Sprintf(" AND v.timestamp <= $%d", idx)
		args = append(args, endDate)
		idx++
	}

	query += fmt.Sprintf(" ORDER BY v.timestamp DESC LIMIT $%d", idx)
	args = append(args, limit)

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch violations: "+err.Error(), start)
		return
	}
	defer rows.Close()

	type ViolationRecord struct {
		EventID       string    `json:"event_id"`
		VehicleID     string    `json:"vehicle_id"`
		GeofenceID    string    `json:"geofence_id"`
		EventType     string    `json:"event_type"`
		Latitude      float64   `json:"latitude"`
		Longitude     float64   `json:"longitude"`
		Timestamp     time.Time `json:"timestamp"`
		VehicleNumber string    `json:"vehicle_number"`
		DriverName    string    `json:"driver_name"`
		VehicleType   string    `json:"vehicle_type"`
		GeofenceName  string    `json:"geofence_name"`
		Category      string    `json:"category"`
	}

	violations := []ViolationRecord{}
	for rows.Next() {
		var vr ViolationRecord
		if err := rows.Scan(
			&vr.EventID, &vr.VehicleID, &vr.GeofenceID, &vr.EventType,
			&vr.Latitude, &vr.Longitude, &vr.Timestamp,
			&vr.VehicleNumber, &vr.DriverName, &vr.VehicleType,
			&vr.GeofenceName, &vr.Category,
		); err != nil {
			continue
		}
		violations = append(violations, vr)
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM violations v WHERE 1=1`
	countArgs := []interface{}{}
	ci := 1
	if vehicleID != "" {
		countQuery += fmt.Sprintf(" AND v.vehicle_id = $%d", ci)
		countArgs = append(countArgs, vehicleID)
		ci++
	}
	if geofenceID != "" {
		countQuery += fmt.Sprintf(" AND v.geofence_id = $%d", ci)
		countArgs = append(countArgs, geofenceID)
		ci++
	}
	if eventType != "" && (eventType == "entry" || eventType == "exit") {
		countQuery += fmt.Sprintf(" AND v.event_type = $%d", ci)
		countArgs = append(countArgs, eventType)
		ci++
	}
	_ = ci
	h.DB.QueryRow(countQuery, countArgs...).Scan(&total)

	h.respond(w, http.StatusOK, map[string]interface{}{
		"violations": violations,
		"count":      len(violations),
		"total":      total,
		"limit":      limit,
	}, start)
}

// helper: check if null string
func nullStrScan(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}
