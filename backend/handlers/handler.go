// Package handlers contains all HTTP request handlers for GeoTrack.
package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"geotrack/ws"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

// NewHandler creates a new Handler with the given DB and WebSocket hub.
func NewHandler(db *sql.DB, hub *ws.Hub) *Handler {
	return &Handler{DB: db, Hub: hub}
}

// respond writes a successful JSON response with time_ns.
func (h *Handler) respond(w http.ResponseWriter, code int, data interface{}, start time.Time) {
	elapsed := time.Since(start).Nanoseconds()
	payload := map[string]interface{}{
		"data":    data,
		"time_ns": fmt.Sprintf("%d", elapsed),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

// respondError writes an error JSON response with time_ns.
func (h *Handler) respondError(w http.ResponseWriter, code int, msg string, start time.Time) {
	elapsed := time.Since(start).Nanoseconds()
	payload := map[string]interface{}{
		"error":   msg,
		"time_ns": fmt.Sprintf("%d", elapsed),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
