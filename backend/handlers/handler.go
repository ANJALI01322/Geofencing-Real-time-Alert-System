// Package handlers contains all HTTP request handlers for GeoTrack.
package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"geotrack/apierr"
	"geotrack/auth"
	"geotrack/ws"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	DB   *sql.DB
	Hub  *ws.Hub
	Auth *auth.Service
}

// NewHandler creates a new Handler with the given DB, WebSocket hub and auth service.
func NewHandler(db *sql.DB, hub *ws.Hub, authSvc *auth.Service) *Handler {
	return &Handler{DB: db, Hub: hub, Auth: authSvc}
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

// respondError writes {"error":{"code","message"}}; the code follows from the HTTP status.
// For 5xx statuses the message is logged and replaced by a generic one, so internals never leak.
func (h *Handler) respondError(w http.ResponseWriter, code int, msg string, _ time.Time) {
	if code >= 500 {
		log.Printf("ERROR %d: %s", code, msg)
		msg = "Something went wrong. Please try again."
	}
	apierr.WriteStatus(w, code, msg)
}

// serverError logs the real cause and returns a generic 500 (no internals leak to clients).
func (h *Handler) serverError(w http.ResponseWriter, what string, err error) {
	log.Printf("ERROR %s: %v", what, err)
	apierr.Write(w, http.StatusInternalServerError, apierr.CodeInternal, "Something went wrong. Please try again.")
}

// maxBodyBytes is the request-body cap; middleware.MaxBody enforces the same value.
const maxBodyBytes = 1 << 20 // 1 MB

// decodeJSON reads the request body into dst. On failure it writes the error response
// (400 for malformed JSON, 413 when the body is over the limit) and returns false.
func (h *Handler) decodeJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			apierr.Write(w, http.StatusRequestEntityTooLarge, apierr.CodePayloadTooLarge, "Request body is too large (limit 1 MB)")
			return false
		}
		apierr.Write(w, http.StatusBadRequest, apierr.CodeValidation, "Request body must be valid JSON")
		return false
	}
	return true
}
