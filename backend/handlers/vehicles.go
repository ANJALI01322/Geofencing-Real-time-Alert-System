package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/lib/pq"

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
	if !h.decodeJSON(w, r, &req) {
		return
	}

	in, err := validateVehicle(req.VehicleNumber, req.DriverName, req.VehicleType, req.PhoneNumber)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	var v models.Vehicle
	err = h.DB.QueryRow(`
		INSERT INTO vehicles (vehicle_number, driver_name, vehicle_type, phone_number)
		VALUES ($1, $2, $3, $4)
		RETURNING id, vehicle_number, driver_name, vehicle_type, phone_number, created_at, updated_at
	`, in.Number, in.Driver, in.Type, in.Phone).
		Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.PhoneNumber, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			h.respondError(w, http.StatusConflict, "Vehicle number already registered", start)
			return
		}
		h.serverError(w, "create vehicle", err)
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
		h.serverError(w, "list vehicles", err)
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

// GetVehicle fetches one vehicle by id (query param vehicle_id). Not routed by default.
func (h *Handler) GetVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vehicleID := strings.TrimSpace(r.URL.Query().Get("vehicle_id"))
	if vehicleID == "" || !isUUID(vehicleID) {
		h.respondError(w, http.StatusBadRequest, "vehicle_id must be a valid UUID", start)
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
		h.serverError(w, "get vehicle", err)
		return
	}

	h.respond(w, http.StatusOK, v, start)
}
