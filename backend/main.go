// GeoTrack – Geofencing & Real-Time Vehicle Alert System
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

	"geotrack/auth"
	"geotrack/db"
	"geotrack/handlers"
	"geotrack/middleware"
	"geotrack/ws"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("🚀 Starting GeoTrack server...")

	// 1. Connect to database
	db.Init()

	// 2. Apply versioned schema migrations (db/migrations/*.sql). A failure is fatal: the
	//    code expects the latest schema.
	if err := db.RunMigrations(); err != nil {
		db.Close()
		log.Fatalf("❌ %v", err)
	}

	// 3. Authentication: signing secret from JWT_SECRET, bootstrap accounts from the env
	secret, _, err := auth.SecretFromEnv()
	if err != nil {
		db.Close()
		log.Fatalf("❌ %v", err)
	}
	authSvc, err := auth.NewService(secret, auth.TokenTTL)
	if err != nil {
		db.Close()
		log.Fatalf("❌ %v", err)
	}
	auth.SeedUsers(db.DB)

	// 4. Background job: delete vehicle_locations older than RETENTION_DAYS (default 7)
	retentionCtx, stopRetention := context.WithCancel(context.Background())
	defer stopRetention()
	days, warn := db.ParseRetentionDays(os.Getenv("RETENTION_DAYS"))
	if warn != "" {
		log.Println("⚠️  " + warn)
	}
	db.StartRetention(retentionCtx, db.DB, days)

	// 5. Start WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// 6. Create handler (injects DB + WebSocket hub + auth service)
	h := handlers.NewHandler(db.DB, hub, authSvc)

	// Rate limiters (per client IP, token bucket)
	trustedHops := trustedProxyHops()
	loginLimiter := middleware.NewLimiter(5, 5)                                          // 5 sign-in attempts per minute
	locationLimiter := middleware.NewLimiter(envFloat("LOCATION_RATE_PER_MIN", 600), 60) // GPS updates

	// 7. Set up router. Browsers' CORS preflights are answered by the CORS middleware before
	//    they reach it, so routes only declare their real methods. Authentication is applied to
	//    the whole router further down: everything except /health and /auth/login needs a token.
	r := mux.NewRouter()

	// Health check (includes a DB ping)
	r.HandleFunc("/health", func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
		defer cancel()

		status, dbStatus, code := "ok", "up", http.StatusOK
		if err := db.DB.PingContext(ctx); err != nil {
			log.Printf("health: db ping failed: %v", err)
			status, dbStatus, code = "degraded", "down", http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     status,
			"db":         dbStatus,
			"service":    "GeoTrack API",
			"ws_clients": hub.ClientCount(),
			"timestamp":  time.Now().UTC(),
		})
	}).Methods("GET")

	// === Authentication ===
	r.Handle("/auth/login", middleware.RateLimit(loginLimiter, trustedHops, http.HandlerFunc(h.Login))).Methods("POST")
	r.HandleFunc("/auth/me", h.Me).Methods("GET")

	// === REST API Endpoints (admin: all methods, viewer: GET only) ===
	// Geofences
	r.HandleFunc("/geofences", h.CreateGeofence).Methods("POST")
	r.HandleFunc("/geofences", h.ListGeofences).Methods("GET")

	// Vehicles
	r.HandleFunc("/vehicles", h.CreateVehicle).Methods("POST")
	r.HandleFunc("/vehicles", h.ListVehicles).Methods("GET")

	// Vehicle locations
	r.Handle("/vehicles/location", middleware.RateLimit(locationLimiter, trustedHops, http.HandlerFunc(h.UpdateLocation))).Methods("POST")
	r.HandleFunc("/vehicles/location/{vehicle_id}", h.GetLocation).Methods("GET")

	// Alert rules
	r.HandleFunc("/alerts/configure", h.ConfigureAlert).Methods("POST")
	r.HandleFunc("/alerts", h.ListAlerts).Methods("GET")

	// Violation history
	r.HandleFunc("/violations/history", h.GetViolations).Methods("GET")
	r.HandleFunc("/violations/stats", h.GetViolationStats).Methods("GET")
	r.HandleFunc("/violations/summary", h.GetViolationSummary).Methods("GET")

	// === WebSocket Endpoint (token via ?token=, checked by the auth middleware) ===
	r.HandleFunc("/ws/alerts", hub.ServeWS).Methods("GET")

	// 8. CORS middleware — allowed origins come from CORS_ORIGINS (comma-separated)
	origins := middleware.ParseOrigins(os.Getenv("CORS_ORIGINS"))
	if len(origins) == 0 {
		log.Println("⚠️  CORS_ORIGINS not set — allowing all origins (set it in production)")
		origins = []string{"*"}
	}
	c := cors.New(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", middleware.RequestIDHeader},
		ExposedHeaders:   []string{"Link", middleware.RequestIDHeader},
		AllowCredentials: true,
		MaxAge:           300,
	})

	// 9. Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		// Outermost first: request ID → access log → panic recovery → security headers → CORS
		// → 1 MB body limit → authentication/roles → router.
		Handler: middleware.RequestID(middleware.Logging(middleware.Recover(
			middleware.SecurityHeaders(c.Handler(middleware.MaxBody(1<<20, authSvc.Middleware(r))))))),
		Addr:         fmt.Sprintf(":%s", port),
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("✅ GeoTrack API listening on http://localhost:%s", port)
	log.Printf("📡 WebSocket endpoint: ws://localhost:%s/ws/alerts", port)
	log.Printf("❤️  Health check:       http://localhost:%s/health", port)

	// 10. Graceful shutdown on SIGINT / SIGTERM
	serverErr := make(chan error, 1)
	go func() { serverErr <- srv.ListenAndServe() }()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			db.Close()
			log.Fatalf("❌ Server error: %v", err)
		}
	case sig := <-stop:
		log.Printf("🛑 Received %s — shutting down (10s timeout)...", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("⚠️  Graceful shutdown failed: %v", err)
		}
	}

	stopRetention()
	db.Close()
	log.Println("👋 GeoTrack stopped cleanly")
}

// trustedProxyHops is how many reverse proxies sit in front of the API and append to
// X-Forwarded-For. TRUSTED_PROXY_HOPS sets it; on Render (which sets RENDER=true) it defaults
// to 1, elsewhere to 0 (use the TCP peer address).
func trustedProxyHops() int {
	if v := os.Getenv("TRUSTED_PROXY_HOPS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			return n
		}
		log.Printf("⚠️  TRUSTED_PROXY_HOPS=%q is not a non-negative integer, ignoring", v)
	}
	if os.Getenv("RENDER") != "" {
		return 1
	}
	return 0
}

// envFloat reads a positive number from the environment, or returns the default.
func envFloat(name string, def float64) float64 {
	if v := os.Getenv(name); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			return f
		}
		log.Printf("⚠️  %s=%q is not a positive number, using %v", name, v, def)
	}
	return def
}
