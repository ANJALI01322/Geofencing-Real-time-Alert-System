package models

import "time"

// Vehicle represents a registered vehicle
type Vehicle struct {
	ID            string    `json:"vehicle_id"`
	VehicleNumber string    `json:"vehicle_number"`
	DriverName    string    `json:"driver_name"`
	VehicleType   string    `json:"vehicle_type"`
	PhoneNumber   string    `json:"phone_number"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Geofence represents a polygonal geofence area
type Geofence struct {
	ID          string       `json:"geofence_id"`
	Name        string       `json:"geofence_name"`
	Description string       `json:"description"`
	Coordinates [][2]float64 `json:"coordinates"`
	Category    string       `json:"category"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// VehicleLocation stores a single GPS reading
type VehicleLocation struct {
	ID        string    `json:"id"`
	VehicleID string    `json:"vehicle_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// AlertRule configures when alerts should fire
type AlertRule struct {
	ID         string    `json:"alert_id"`
	GeofenceID string    `json:"geofence_id"`
	VehicleID  *string   `json:"vehicle_id"` // nil means all vehicles
	EventType  string    `json:"event_type"` // entry | exit | both
	CreatedAt  time.Time `json:"created_at"`
}

// Violation is a recorded entry/exit event
type Violation struct {
	ID         string    `json:"event_id"`
	VehicleID  string    `json:"vehicle_id"`
	GeofenceID string    `json:"geofence_id"`
	EventType  string    `json:"event_type"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Timestamp  time.Time `json:"timestamp"`
}

// AlertEvent is the WebSocket message format
type AlertEvent struct {
	EventID   string       `json:"event_id"`
	EventType string       `json:"event_type"`
	Timestamp time.Time    `json:"timestamp"`
	Vehicle   VehicleInfo  `json:"vehicle"`
	Geofence  GeofenceInfo `json:"geofence"`
	Location  LocationInfo `json:"location"`
}

type VehicleInfo struct {
	VehicleID     string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type GeofenceInfo struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type LocationInfo struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
