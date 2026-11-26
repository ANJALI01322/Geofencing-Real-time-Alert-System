package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"geotrack/apierr"
)

// fakeClock is a manually advanced time source for the limiter.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newClockedLimiter(perMinute float64, burst int) (*Limiter, *fakeClock) {
	c := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	l := NewLimiter(perMinute, burst)
	l.now = c.now
	return l, c
}

func TestLimiter_BurstThenBlock(t *testing.T) {
	l, _ := newClockedLimiter(5, 5)
	for i := 1; i <= 5; i++ {
		if ok, _ := l.Allow("1.2.3.4"); !ok {
			t.Fatalf("request %d of the burst should pass", i)
		}
	}
	ok, wait := l.Allow("1.2.3.4")
	if ok {
		t.Fatal("6th request within the minute must be blocked")
	}
	if wait <= 0 || wait > 13*time.Second {
		t.Errorf("retry-after should be ~12s (one token at 5/min), got %v", wait)
	}
}

func TestLimiter_RefillsOverTime(t *testing.T) {
	l, clock := newClockedLimiter(5, 5)
	for i := 0; i < 5; i++ {
		l.Allow("ip")
	}
	if ok, _ := l.Allow("ip"); ok {
		t.Fatal("should be empty")
	}
	clock.advance(13 * time.Second) // 5/min = one token per 12s
	if ok, _ := l.Allow("ip"); !ok {
		t.Fatal("a token should have refilled after 13s")
	}
	if ok, _ := l.Allow("ip"); ok {
		t.Fatal("only one token should have refilled")
	}
	clock.advance(10 * time.Minute) // refill is capped at the burst size
	n := 0
	for ok, _ := l.Allow("ip"); ok; ok, _ = l.Allow("ip") {
		n++
	}
	if n != 5 {
		t.Errorf("after a long idle the bucket holds exactly the burst (5), got %d", n)
	}
}

func TestLimiter_KeysAreIndependent(t *testing.T) {
	l, _ := newClockedLimiter(5, 2)
	l.Allow("a")
	l.Allow("a")
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("a should be limited")
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("b must not be affected by a")
	}
}

func TestLimiter_SweepsIdleBuckets(t *testing.T) {
	l, clock := newClockedLimiter(60, 5)
	for _, ip := range []string{"a", "b", "c"} {
		l.Allow(ip)
	}
	clock.advance(sweepEvery + time.Minute)
	l.Allow("d") // triggers the sweep
	if n := len(l.buckets); n != 1 {
		t.Errorf("idle buckets should be swept, %d left", n)
	}
}

func TestRateLimit_Returns429WithJSONAndRetryAfter(t *testing.T) {
	l, _ := newClockedLimiter(5, 5)
	h := RateLimit(l, 0, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))

	send := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/auth/login", nil)
		req.RemoteAddr = "9.9.9.9:1234"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	for i := 0; i < 5; i++ {
		if rec := send(); rec.Code != 200 {
			t.Fatalf("attempt %d: want 200, got %d", i+1, rec.Code)
		}
	}
	rec := send()
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("want 429, got %d", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("429 must carry Retry-After")
	}
	var b apierr.Body
	if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil || b.Error.Code != apierr.CodeRateLimited {
		t.Errorf("want RATE_LIMITED error envelope, got %s", rec.Body.String())
	}
}

func TestClientIP(t *testing.T) {
	mk := func(remote, xff string) *http.Request {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}
	cases := []struct {
		name string
		r    *http.Request
		hops int
		want string
	}{
		{"no proxy uses the TCP peer", mk("10.0.0.1:5000", ""), 0, "10.0.0.1"},
		{"no proxy ignores X-Forwarded-For (it is client-controlled)", mk("10.0.0.1:5000", "6.6.6.6"), 0, "10.0.0.1"},
		{"one proxy: last entry is the client the proxy saw", mk("10.0.0.1:5000", "203.0.113.9"), 1, "203.0.113.9"},
		{"one proxy: spoofed left entries are ignored", mk("10.0.0.1:5000", "6.6.6.6, 203.0.113.9"), 1, "203.0.113.9"},
		{"two proxies: second from the right", mk("10.0.0.1:5000", "203.0.113.9, 172.16.0.5"), 2, "203.0.113.9"},
		{"header shorter than hops falls back to the peer", mk("10.0.0.1:5000", "203.0.113.9"), 2, "10.0.0.1"},
		{"garbage header falls back to the peer", mk("10.0.0.1:5000", "not-an-ip"), 1, "10.0.0.1"},
		{"missing header falls back to the peer", mk("10.0.0.1:5000", ""), 1, "10.0.0.1"},
	}
	for _, c := range cases {
		if got := ClientIP(c.r, c.hops); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestMaxBody(t *testing.T) {
	read := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := io.ReadAll(r.Body); err != nil {
			apierr.Write(w, http.StatusRequestEntityTooLarge, apierr.CodePayloadTooLarge, "too big")
			return
		}
		w.WriteHeader(200)
	})
	h := MaxBody(10, read)

	small := httptest.NewRecorder()
	h.ServeHTTP(small, httptest.NewRequest("POST", "/", strings.NewReader("0123456789")))
	if small.Code != 200 {
		t.Errorf("body at the limit: want 200, got %d", small.Code)
	}

	declared := httptest.NewRecorder()
	h.ServeHTTP(declared, httptest.NewRequest("POST", "/", strings.NewReader(strings.Repeat("x", 11))))
	if declared.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("declared Content-Length over the limit: want 413, got %d", declared.Code)
	}

	// A body whose length is unknown (chunked) is still cut off while it is read.
	req := httptest.NewRequest("POST", "/", io.NopCloser(strings.NewReader(strings.Repeat("x", 50))))
	req.ContentLength = -1
	chunked := httptest.NewRecorder()
	h.ServeHTTP(chunked, req)
	if chunked.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("chunked body over the limit: want 413, got %d", chunked.Code)
	}
}

func TestRecover_ReturnsJSON500(t *testing.T) {
	h := Recover(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", rec.Code)
	}
	var b apierr.Body
	if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil || b.Error.Code != apierr.CodeInternal {
		t.Fatalf("want INTERNAL_ERROR envelope, got %s", rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Error("the panic value must not leak to the client")
	}
}

func TestRecover_PassesThroughNormalRequests(t *testing.T) {
	h := Recover(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Code != 204 {
		t.Fatalf("want 204, got %d", rec.Code)
	}
}

func TestSecurityHeaders(t *testing.T) {
	h := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	want := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "no-referrer",
		"Cache-Control":          "no-store",
	}
	for k, v := range want {
		if got := rec.Header().Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
}
