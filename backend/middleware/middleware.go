// Package middleware holds HTTP middleware: request IDs, access logging and
// CORS origin parsing.
package middleware

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// RequestIDHeader is the header used to carry the request ID in and out.
const RequestIDHeader = "X-Request-ID"

// statusRecorder captures the status code written by a handler.
// It also forwards Hijack/Flush so WebSocket upgrades keep working.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := s.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("middleware: underlying ResponseWriter does not support hijacking")
	}
	// A successful hijack (WebSocket upgrade) means 101 Switching Protocols.
	s.status = http.StatusSwitchingProtocols
	return h.Hijack()
}

func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func newRequestID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

// RequestID makes sure every request has an ID: it reuses the incoming
// X-Request-ID header if present, otherwise generates one, and echoes it back.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(RequestIDHeader)
		if id == "" {
			id = newRequestID()
			r.Header.Set(RequestIDHeader, id)
		}
		w.Header().Set(RequestIDHeader, id)
		next.ServeHTTP(w, r)
	})
}

// Logging logs method, path, status and duration for every request.
// Wrap it inside RequestID so the ID is available.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s id=%s",
			r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Microsecond), r.Header.Get(RequestIDHeader))
	})
}

// ParseOrigins turns a comma-separated list (e.g. the CORS_ORIGINS env var)
// into a clean slice. Empty entries are dropped.
func ParseOrigins(raw string) []string {
	var out []string
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	return out
}
