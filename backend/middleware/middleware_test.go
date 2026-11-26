package middleware

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestRequestID_GeneratesAndEchoes(t *testing.T) {
	h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(RequestIDHeader) == "" {
			t.Error("handler should see a request ID")
		}
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Header().Get(RequestIDHeader) == "" {
		t.Error("response should carry an X-Request-ID header")
	}
}

func TestRequestID_ReusesIncoming(t *testing.T) {
	h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set(RequestIDHeader, "abc123")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get(RequestIDHeader); got != "abc123" {
		t.Errorf("expected incoming ID to be reused, got %q", got)
	}
}

func TestLogging_PassesStatusThrough(t *testing.T) {
	h := Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Code != http.StatusTeapot {
		t.Errorf("expected 418, got %d", rec.Code)
	}
}

func TestParseOrigins(t *testing.T) {
	got := ParseOrigins(" https://a.com, ,https://b.com ,")
	want := []string{"https://a.com", "https://b.com"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
	if len(ParseOrigins("")) != 0 {
		t.Error("empty input should give no origins")
	}
}
