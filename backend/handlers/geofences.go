package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"geotrack/models"
)

// validCategories are the zone categories the database CHECK constraint accepts.
var validCategories = map[string]bool{
	"delivery_zone":   true,
	"restricted_zone": true,
	"toll_zone":       true,
	"customer_area":   true,
}

// CreateGeofence handles POST /geofences
func (h *Handler) CreateGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		Name        string       `json:"name"`
		Description string       `json:"description"`
		Coordinates [][2]float64 `json:"coordinates"`
		Category    string       `json:"category"`
	}
	if !h.decodeJSON(w, r, &req) {
		return
	}

	name, err := validateGeofenceName(req.Name)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}
	if !validCategories[req.Category] {
		h.respondError(w, http.StatusBadRequest,
			"category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area", start)
		return
	}
	if err := validatePolygon(req.Coordinates); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	// Serialize coordinates to JSON for storage
	coordsJSON, err := json.Marshal(req.Coordinates)
	if err != nil {
		h.serverError(w, "encode coordinates", err)
		return
	}

	var gf models.Geofence
	var coordsRaw []byte
	err = h.DB.QueryRow(`
		INSERT INTO geofences (name, description, coordinates, category)
		VALUES ($1, $2, $3::jsonb, $4)
		RETURNING id, name, description, coordinates, category, created_at, updated_at
	`, name, req.Description, string(coordsJSON), req.Category).
		Scan(&gf.ID, &gf.Name, &gf.Description, &coordsRaw, &gf.Category, &gf.CreatedAt, &gf.UpdatedAt)
	if err != nil {
		h.serverError(w, "create geofence", err)
		return
	}

	json.Unmarshal(coordsRaw, &gf.Coordinates)
	h.respond(w, http.StatusCreated, gf, start)
}

// ListGeofences handles GET /geofences
// Optional query param: ?category=delivery_zone
func (h *Handler) ListGeofences(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	category := r.URL.Query().Get("category")

	query := `SELECT id, name, description, coordinates, category, created_at, updated_at
	          FROM geofences ORDER BY created_at DESC`
	var args []interface{}
	if category != "" {
		if !validCategories[category] {
			h.respondError(w, http.StatusBadRequest, "Invalid category filter", start)
			return
		}
		query = `SELECT id, name, description, coordinates, category, created_at, updated_at
		         FROM geofences WHERE category = $1 ORDER BY created_at DESC`
		args = []interface{}{category}
	}

	dbRows, err := h.DB.Query(query, args...)
	if err != nil {
		h.serverError(w, "list geofences", err)
		return
	}
	defer dbRows.Close()

	geofences := []models.Geofence{}
	for dbRows.Next() {
		var gf models.Geofence
		var coordsRaw []byte
		if err := dbRows.Scan(&gf.ID, &gf.Name, &gf.Description, &coordsRaw, &gf.Category, &gf.CreatedAt, &gf.UpdatedAt); err != nil {
			continue
		}
		json.Unmarshal(coordsRaw, &gf.Coordinates)
		geofences = append(geofences, gf)
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"geofences": geofences,
		"count":     len(geofences),
	}, start)
}
