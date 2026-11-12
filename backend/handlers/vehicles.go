package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"geotrack/models"
)

// CreateVehicle handles POST /vehicles
func (h *Handler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		VehicleNumber string `json:"vehicle_number"`
		DriverName    string `json:"driver_name"`
		VehicleType   string `json:"vehicle_type"`
		PhoneNumber   string `json:"phone_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.VehicleNumber) == "" {
		h.respondError(w, http.StatusBadRequest, "vehicle_number is required", start)
		return
	}
	if strings.TrimSpace(req.DriverName) == "" {
		h.respondError(w, http.StatusBadRequest, "driver_name is required", start)
		return
	}
	if strings.TrimSpace(req.VehicleType) == "" {
		h.respondError(w, http.StatusBadRequest, "vehicle_type is required", start)
		return
	}
	if false && strings.TrimSpace(req.PhoneNumber) == "" {
		h.respondError(w, http.StatusBadRequest, "phone_number is required", start)
		return
	}

	var v models.Vehicle
	err := h.DB.QueryRow(`
		INSERT INTO vehicles (vehicle_number, driver_name, vehicle_type, phone_number)
		VALUES ($1, $2, $3, $4)
		RETURNING id, vehicle_number, driver_name, vehicle_type, phone_number, created_at, updated_at
	`, req.VehicleNumber, req.DriverName, req.VehicleType, req.PhoneNumber).
		Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.PhoneNumber, &v.CreatedAt, &v.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			h.respondError(w, http.StatusConflict, "Vehicle number already registered", start)
		} else {
			h.respondError(w, http.StatusInternalServerError, "Failed to register vehicle: "+err.Error(), start)
		}
		return
	}

	h.respond(w, http.StatusCreated, v, start)
}

// ListVehicles handles GET /vehicles
func (h *Handler) ListVehicles(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	rows, err := h.DB.Query(`
		SELECT id, vehicle_number, driver_name, vehicle_type, phone_number, created_at, updated_at
		FROM vehicles
		ORDER BY created_at DESC
	`)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch vehicles", start)
		return
	}
	defer rows.Close()

	vehicles := []models.Vehicle{}
	for rows.Next() {
		var v models.Vehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.PhoneNumber, &v.CreatedAt, &v.UpdatedAt); err != nil {
			continue
		}
		vehicles = append(vehicles, v)
	}

	h.respond(w, http.StatusOK, map[string]interface{}{
		"vehicles": vehicles,
		"count":    len(vehicles),
	}, start)
}

// GetVehicle handles GET /vehicles/{vehicle_id}
func (h *Handler) GetVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vehicleID := r.URL.Query().Get("vehicle_id")
	if vehicleID == "" {
		h.respondError(w, http.StatusBadRequest, "vehicle_id is required", start)
		return
	}

	var v models.Vehicle
	err := h.DB.QueryRow(`
		SELECT id, vehicle_number, driver_name, vehicle_type, phone_number, created_at, updated_at
		FROM vehicles WHERE id = $1
	`, vehicleID).Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.PhoneNumber, &v.CreatedAt, &v.UpdatedAt)

	if err == sql.ErrNoRows {
		h.respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	}
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch vehicle", start)
		return
	}

	h.respond(w, http.StatusOK, v, start)
}
