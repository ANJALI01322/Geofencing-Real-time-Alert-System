package middleware

import (
	"log"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"

	"geotrack/apierr"
)

// ── Security headers ─────────────────────────────────────────────────────────

// SecurityHeaders adds baseline hardening headers to every response. The API serves JSON only,
// so framing is denied outright and nothing is cached.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// ── Request body limit ───────────────────────────────────────────────────────

// MaxBody rejects request bodies larger than limit bytes: immediately (413) when Content-Length
// already says so, and while reading otherwise (the handler's JSON decode then fails with
// *http.MaxBytesError, which decodeJSON turns into 413).
func MaxBody(limit int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > limit {
			apierr.Write(w, http.StatusRequestEntityTooLarge, apierr.CodePayloadTooLarge, "Request body is too large (limit 1 MB)")
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, limit)
		}
		next.ServeHTTP(w, r)
	})
}

// ── Panic recovery ───────────────────────────────────────────────────────────

// Recover turns a handler panic into a logged JSON 500 instead of a dropped connection.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec) // net/http uses this to abort a response on purpose
			}
			log.Printf("PANIC %s %s id=%s: %v\n%s", r.Method, r.URL.Path, r.Header.Get(RequestIDHeader), rec, debug.Stack())
			apierr.Write(w, http.StatusInternalServerError, apierr.CodeInternal, "Something went wrong. Please try again.")
		}()
		next.ServeHTTP(w, r)
	})
}

// ── Per-IP rate limiting (token bucket) ──────────────────────────────────────

type bucket struct {
	tokens float64
	last   time.Time
}

// Limiter is a token-bucket rate limiter keyed by string (here: client IP). Each key may burst
// up to `burst` requests, refilled at `perMinute` tokens per minute.
type Limiter struct {
	mu        sync.Mutex
	rate      float64 // tokens per second
	burst     float64
	buckets   map[string]*bucket
	lastSweep time.Time
	now       func() time.Time
}

const (
	sweepEvery = 5 * time.Minute
	maxKeys    = 100000 // memory guard; beyond this new keys are let through untracked
)

// NewLimiter creates a limiter allowing perMinute requests per minute with the given burst.
func NewLimiter(perMinute float64, burst int) *Limiter {
	return &Limiter{
		rate:    perMinute / 60,
		burst:   float64(burst),
		buckets: map[string]*bucket{},
		now:     time.Now,
	}
}

// Allow takes one token for key. When none is left it returns false and how long until one is.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()

	if now.Sub(l.lastSweep) > sweepEvery {
		l.sweep(now)
	}

	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= maxKeys {
			return true, 0
		}
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}

	b.tokens += now.Sub(b.last).Seconds() * l.rate
	if b.tokens > l.burst {
		b.tokens = l.burst
	}
	b.last = now

	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := time.Duration((1 - b.tokens) / l.rate * float64(time.Second))
	return false, wait
}

// sweep drops buckets that have been idle long enough to be full again (equivalent to absent).
func (l *Limiter) sweep(now time.Time) {
	l.lastSweep = now
	refill := time.Duration(l.burst / l.rate * float64(time.Second))
	for k, b := range l.buckets {
		if now.Sub(b.last) > refill {
			delete(l.buckets, k)
		}
	}
}

// RateLimit wraps next so that each client IP is limited by l. Rejected requests get a 429 with
// a Retry-After header.
func RateLimit(l *Limiter, trustedHops int, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ok, wait := l.Allow(ClientIP(r, trustedHops)); !ok {
			secs := int(wait.Seconds()) + 1
			w.Header().Set("Retry-After", strconv.Itoa(secs))
			apierr.Write(w, http.StatusTooManyRequests, apierr.CodeRateLimited,
				"Too many requests. Try again in "+strconv.Itoa(secs)+" seconds.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ClientIP returns the caller's address. With trustedHops = 0 that is the TCP peer. Behind
// trustedHops reverse proxies (each appends the address it saw to X-Forwarded-For) the real
// client is the trustedHops-th entry from the right; entries further left are client-supplied
// and ignored, so a spoofed header cannot dodge the limiter.
func ClientIP(r *http.Request, trustedHops int) string {
	if trustedHops > 0 {
		parts := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		if i := len(parts) - trustedHops; i >= 0 {
			if ip := strings.TrimSpace(parts[i]); net.ParseIP(ip) != nil {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
