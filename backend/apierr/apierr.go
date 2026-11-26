// Package apierr writes the API's single error format, shared by handlers and
// middleware so every failure looks the same to clients:
//
//	{"error":{"code":"VALIDATION_ERROR","message":"latitude must be between -90 and 90"}}
package apierr

import (
	"encoding/json"
	"net/http"
)

// Error codes. Clients switch on these; messages are for humans.
const (
	CodeValidation      = "VALIDATION_ERROR"
	CodeUnauthorized    = "UNAUTHORIZED"
	CodeForbidden       = "FORBIDDEN"
	CodeNotFound        = "NOT_FOUND"
	CodeConflict        = "CONFLICT"
	CodePayloadTooLarge = "PAYLOAD_TOO_LARGE"
	CodeRateLimited     = "RATE_LIMITED"
	CodeInternal        = "INTERNAL_ERROR"
)

// Body is the JSON envelope of an error response.
type Body struct {
	Error Detail `json:"error"`
}

// Detail is the machine-readable code plus a human-readable message.
type Detail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// CodeFor maps an HTTP status to its default error code.
func CodeFor(status int) string {
	switch status {
	case http.StatusUnauthorized:
		return CodeUnauthorized
	case http.StatusForbidden:
		return CodeForbidden
	case http.StatusNotFound:
		return CodeNotFound
	case http.StatusConflict:
		return CodeConflict
	case http.StatusRequestEntityTooLarge:
		return CodePayloadTooLarge
	case http.StatusTooManyRequests:
		return CodeRateLimited
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return CodeValidation
	default:
		if status >= 500 {
			return CodeInternal
		}
		return CodeValidation
	}
}

// Write sends an error response with an explicit code.
func Write(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Body{Error: Detail{Code: code, Message: message}})
}

// WriteStatus sends an error response using the default code for the status.
func WriteStatus(w http.ResponseWriter, status int, message string) {
	Write(w, status, CodeFor(status), message)
}
