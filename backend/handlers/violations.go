package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Pagination limits for GET /violations/history.
const (
	defaultPageSize = 50
	maxPageSize     = 100
)

// violationFilter holds the (already validated) filters of a violations query.
type violationFilter struct {
	VehicleID  string
	GeofenceID string
	EventType  string
	From, To   *time.Time
}

// where builds the WHERE clause and its arguments. The same clause drives both the page
// query and the total count, so `total` always matches the filtered result set.
func (f violationFilter) where() (string, []interface{}) {
	clause := " WHERE 1=1"
	args := []interface{}{}
	add := func(cond string, v interface{}) {
		args = append(args, v)
		clause += fmt.Sprintf(" AND "+cond, len(args))
	}
	if f.VehicleID != "" {
		add("v.vehicle_id = $%d", f.VehicleID)
	}
	if f.GeofenceID != "" {
		add("v.geofence_id = $%d", f.GeofenceID)
	}
	if f.EventType != "" {
		add("v.event_type = $%d", f.EventType)
	}
	if f.From != nil {
		add("v.timestamp >= $%d", *f.From)
	}
	if f.To != nil {
		add("v.timestamp <= $%d", *f.To)
	}
	return clause, args
}

// buildViolationsQuery returns the page query. Rows are ordered newest-first with the id as a
// tie-break, so consecutive pages never skip or repeat rows that share a timestamp.
func buildViolationsQuery(f violationFilter, limit, offset int) (string, []interface{}) {
	clause, args := f.where()
	args = append(args, limit, offset)
	q := `
		SELECT
			v.id, v.vehicle_id, COALESCE(v.geofence_id::text, ''), v.event_type,
			v.latitude, v.longitude, v.timestamp,
			vh.vehicle_number, vh.driver_name, vh.vehicle_type,
			COALESCE(g.name, '') AS geofence_name, COALESCE(g.category, '')
		FROM violations v
		JOIN vehicles  vh ON vh.id = v.vehicle_id
		LEFT JOIN geofences g ON g.id = v.geofence_id` + clause +
		fmt.Sprintf(" ORDER BY v.timestamp DESC, v.id DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	return q, args
}

// buildViolationsCount returns the query for the total number of rows matching the filters.
func buildViolationsCount(f violationFilter) (string, []interface{}) {
	clause, args := f.where()
	return "SELECT COUNT(*) FROM violations v" + clause, args
}

// parsePagination reads ?limit and ?offset. limit defaults to 50 and is capped at 100.
func parsePagination(q url.Values) (limit, offset int, err error) {
	limit = defaultPageSize
	if s := q.Get("limit"); s != "" {
		n, convErr := strconv.Atoi(s)
		if convErr != nil || n < 1 {
			return 0, 0, fmt.Errorf("limit must be a positive integer (max %d)", maxPageSize)
		}
		if n > maxPageSize {
			n = maxPageSize
		}
		limit = n
	}
	if s := q.Get("offset"); s != "" {
		n, convErr := strconv.Atoi(s)
		if convErr != nil || n < 0 {
			return 0, 0, fmt.Errorf("offset must be a non-negative integer")
		}
		offset = n
	}
	return limit, offset, nil
}

// parseViolationFilter validates the query string of GET /violations/history.
func parseViolationFilter(q url.Values) (violationFilter, error) {
	f := violationFilter{
		VehicleID:  strings.TrimSpace(q.Get("vehicle_id")),
		GeofenceID: strings.TrimSpace(q.Get("geofence_id")),
		EventType:  strings.TrimSpace(q.Get("event_type")),
	}
	if f.VehicleID != "" && !isUUID(f.VehicleID) {
		return f, fmt.Errorf("vehicle_id must be a valid UUID")
	}
	if f.GeofenceID != "" && !isUUID(f.GeofenceID) {
		return f, fmt.Errorf("geofence_id must be a valid UUID")
	}
	if f.EventType != "" && !violationEventTypes[f.EventType] {
		return f, fmt.Errorf("event_type must be one of: entry, exit, speed_violation")
	}
	if s := strings.TrimSpace(q.Get("start_date")); s != "" {
		t, err := parseTimeParam(s, false)
		if err != nil {
			return f, fmt.Errorf("start_date %v", err)
		}
		f.From = &t
	}
	if s := strings.TrimSpace(q.Get("end_date")); s != "" {
		t, err := parseTimeParam(s, true)
		if err != nil {
			return f, fmt.Errorf("end_date %v", err)
		}
		f.To = &t
	}
	return f, nil
}

// GetViolations handles GET /violations/history
//
// Query: vehicle_id, geofence_id, event_type (entry|exit|speed_violation), start_date, end_date,
// limit (default 50, max 100), offset (default 0).
// Response data: violations[], count (rows in this page), total (rows matching the filters),
// limit, offset, has_more.
func (h *Handler) GetViolations(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	q := r.URL.Query()
	f, err := parseViolationFilter(q)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}
	limit, offset, err := parsePagination(q)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	query, args := buildViolationsQuery(f, limit, offset)
	rows, err := h.DB.Query(query, args...)
	if err != nil {
		h.serverError(w, "fetch violations", err)
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
	if err := rows.Err(); err != nil {
		h.serverError(w, "read violations", err)
		return
	}

	countQuery, countArgs := buildViolationsCount(f)
	var total int
	if err := h.DB.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		h.serverError(w, "count violations", err)
		return
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"violations": violations,
		"count":      len(violations),
		"total":      total,
		"limit":      limit,
		"offset":     offset,
		"has_more":   offset+len(violations) < total,
	}, start)
}

// GetViolationStats handles GET /violations/stats
func (h *Handler) GetViolationStats(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	rows, err := h.DB.Query(`SELECT event_type, COUNT(*) as count FROM violations GROUP BY event_type`)
	if err != nil {
		h.serverError(w, "violation stats", err)
		return
	}
	defer rows.Close()

	stats := map[string]int{"entry": 0, "exit": 0, "speed": 0}
	for rows.Next() {
		var eventType string
		var count int
		if err := rows.Scan(&eventType, &count); err != nil {
			continue
		}
		switch strings.ToLower(eventType) {
		case "entry":
			stats["entry"] += count
		case "exit":
			stats["exit"] += count
		case "speed_violation":
			stats["speed"] += count
		}
	}

	h.respond(w, http.StatusOK, stats, start)
}

// GetViolationSummary handles GET /violations/summary: violation counts per zone and per
// vehicle over ALL rows. The Geofences and Fleet Status pages use it instead of downloading
// the whole history, which pagination no longer allows.
func (h *Handler) GetViolationSummary(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	type zoneCount struct {
		GeofenceID string `json:"geofence_id"`
		Count      int    `json:"count"`
	}
	type vehicleCount struct {
		VehicleID     string    `json:"vehicle_id"`
		Count         int       `json:"count"`
		LastTimestamp time.Time `json:"last_timestamp"`
	}

	byZone := []zoneCount{}
	zr, err := h.DB.Query(`
		SELECT geofence_id::text, COUNT(*) FROM violations
		WHERE geofence_id IS NOT NULL GROUP BY geofence_id`)
	if err != nil {
		h.serverError(w, "violation summary (zones)", err)
		return
	}
	defer zr.Close()
	for zr.Next() {
		var z zoneCount
		if err := zr.Scan(&z.GeofenceID, &z.Count); err == nil {
			byZone = append(byZone, z)
		}
	}

	byVehicle := []vehicleCount{}
	vr, err := h.DB.Query(`
		SELECT vehicle_id::text, COUNT(*), MAX(timestamp) FROM violations GROUP BY vehicle_id`)
	if err != nil {
		h.serverError(w, "violation summary (vehicles)", err)
		return
	}
	defer vr.Close()
	for vr.Next() {
		var v vehicleCount
		if err := vr.Scan(&v.VehicleID, &v.Count, &v.LastTimestamp); err == nil {
			byVehicle = append(byVehicle, v)
		}
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"by_zone":    byZone,
		"by_vehicle": byVehicle,
	}, start)
}
