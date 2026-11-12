package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"geotrack/models"
)

var validCategories = map[string]bool{
	"restricted":     true,
	"parking":         true,
	"warehouse":       true,
	"delivery":        true,
	"delivery_zone":  true,
	"restricted_zone": true,
	"toll_zone":      true,
	"customer_area":  true,
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}

	// Validate name
	if strings.TrimSpace(req.Name) == "" {
		h.respondError(w, http.StatusBadRequest, "name is required", start)
		return
	}

	// Validate category
	if !validCategories[req.Category] {
		h.respondError(w, http.StatusBadRequest,
			"category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area", start)
		return
	}

	// Validate coordinates
	if err := validatePolygon(req.Coordinates); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	// Serialize coordinates to JSON for storage
	coordsJSON, err := json.Marshal(req.Coordinates)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to encode coordinates", start)
		return
	}

	var gf models.Geofence
	var coordsRaw []byte
	err = h.DB.QueryRow(`
		INSERT INTO geofences (name, description, coordinates, category)
		VALUES ($1, $2, $3::jsonb, $4)
		RETURNING id, name, description, coordinates, category, created_at, updated_at
	`, req.Name, req.Description, string(coordsJSON), req.Category).
		Scan(&gf.ID, &gf.Name, &gf.Description, &coordsRaw, &gf.Category, &gf.CreatedAt, &gf.UpdatedAt)

	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create geofence: "+err.Error(), start)
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

	var rows interface{ Scan(...interface{}) error }
	var query string
	var args []interface{}

	if category != "" {
		if !validCategories[category] {
			h.respondError(w, http.StatusBadRequest, "Invalid category filter", start)
			return
		}
		query = `SELECT id, name, description, coordinates, category, created_at, updated_at
		          FROM geofences WHERE category = $1 ORDER BY created_at DESC`
		args = []interface{}{category}
	} else {
		query = `SELECT id, name, description, coordinates, category, created_at, updated_at
		          FROM geofences ORDER BY created_at DESC`
	}

	dbRows, err := h.DB.Query(query, args...)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch geofences", start)
		return
	}
	defer dbRows.Close()
	_ = rows // avoid unused warning

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

// validatePolygon checks all polygon invariants:
//  1. At least 4 coordinate pairs
//  2. Polygon must be closed (first == last)
//  3. Lat ∈ [-90, 90] and Lng ∈ [-180, 180]
func validatePolygon(coords [][2]float64) error {
	if len(coords) < 4 {
		return fmt.Errorf("polygon must have at least 4 coordinate pairs (got %d)", len(coords))
	}

	first := coords[0]
	last := coords[len(coords)-1]
	if first[0] != last[0] || first[1] != last[1] {
		return fmt.Errorf("polygon must be closed: first and last coordinates must match")
	}

	for i, c := range coords {
		if c[0] < -90 || c[0] > 90 {
			return fmt.Errorf("coordinate[%d]: latitude %.6f is out of range [-90, 90]", i, c[0])
		}
		if c[1] < -180 || c[1] > 180 {
			return fmt.Errorf("coordinate[%d]: longitude %.6f is out of range [-180, 180]", i, c[1])
		}
	}

	return nil
}
