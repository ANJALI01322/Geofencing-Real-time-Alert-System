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
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

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

	// 2. Run schema migrations
	db.RunMigrations()

	// 3. Start WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// 4. Create handler (injects DB + WebSocket hub)
	h := handlers.NewHandler(db.DB, hub)

	// 5. Set up router
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
	}).Methods("GET", "OPTIONS")

	// === REST API Endpoints ===
	// Geofences
	r.HandleFunc("/geofences", h.CreateGeofence).Methods("POST", "OPTIONS")
	r.HandleFunc("/geofences", h.ListGeofences).Methods("GET", "OPTIONS")

	// Vehicles
	r.HandleFunc("/vehicles", h.CreateVehicle).Methods("POST", "OPTIONS")
	r.HandleFunc("/vehicles", h.ListVehicles).Methods("GET", "OPTIONS")

	// Vehicle locations
	r.HandleFunc("/vehicles/location", h.UpdateLocation).Methods("POST", "OPTIONS")
	r.HandleFunc("/vehicles/location/{vehicle_id}", h.GetLocation).Methods("GET", "OPTIONS")

	// Alert rules
	r.HandleFunc("/alerts/configure", h.ConfigureAlert).Methods("POST", "OPTIONS")
	r.HandleFunc("/alerts", h.ListAlerts).Methods("GET", "OPTIONS")

	// Violation history
	r.HandleFunc("/violations/history", h.GetViolations).Methods("GET", "OPTIONS")
	r.HandleFunc("/violations/stats", h.GetViolationStats).Methods("GET", "OPTIONS")

	// === WebSocket Endpoint ===
	r.HandleFunc("/ws/alerts", hub.ServeWS)

	// 6. CORS middleware — allowed origins come from CORS_ORIGINS (comma-separated)
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

	// 7. Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Handler:      middleware.RequestID(middleware.Logging(c.Handler(r))),
		Addr:         fmt.Sprintf(":%s", port),
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("✅ GeoTrack API listening on http://localhost:%s", port)
	log.Printf("📡 WebSocket endpoint: ws://localhost:%s/ws/alerts", port)
	log.Printf("❤️  Health check:       http://localhost:%s/health", port)

	// 8. Graceful shutdown on SIGINT / SIGTERM
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

	db.Close()
	log.Println("👋 GeoTrack stopped cleanly")
}
