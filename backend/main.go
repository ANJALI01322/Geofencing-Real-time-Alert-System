// GeoTrack – Geofencing & Real-Time Vehicle Alert System
// MapUp Full-Stack Developer Assessment
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

	"geotrack/db"
	"geotrack/handlers"
	"geotrack/ws"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("🚀 Starting GeoTrack server...")

	// 1. Connect to database
	db.Init()
	defer db.Close()

	// 2. Run schema migrations
	db.RunMigrations()

	// 3. Start WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// 4. Create handler (injects DB + WebSocket hub)
	h := handlers.NewHandler(db.DB, hub)

	// 5. Set up router
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "ok",
			"service":    "GeoTrack API",
			"ws_clients": hub.ClientCount(),
			"timestamp":  time.Now().UTC(),
		})
	}).Methods("GET", "OPTIONS")

	// === REST API Endpoints ===
	// Geofences
	r.HandleFunc("/geofences",   h.CreateGeofence).Methods("POST", "OPTIONS")
	r.HandleFunc("/geofences",   h.ListGeofences).Methods("GET", "OPTIONS")

	// Vehicles
	r.HandleFunc("/vehicles",    h.CreateVehicle).Methods("POST", "OPTIONS")
	r.HandleFunc("/vehicles",    h.ListVehicles).Methods("GET", "OPTIONS")

	// Vehicle locations
	r.HandleFunc("/vehicles/location",              h.UpdateLocation).Methods("POST", "OPTIONS")
	r.HandleFunc("/vehicles/location/{vehicle_id}", h.GetLocation).Methods("GET", "OPTIONS")

	// Alert rules
	r.HandleFunc("/alerts/configure", h.ConfigureAlert).Methods("POST", "OPTIONS")
	r.HandleFunc("/alerts",           h.ListAlerts).Methods("GET", "OPTIONS")

	// Violation history
	r.HandleFunc("/violations/history", h.GetViolations).Methods("GET", "OPTIONS")

	// === WebSocket Endpoint ===
	r.HandleFunc("/ws/alerts", hub.ServeWS)

	// 6. CORS middleware (allow all origins for development)
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	// 7. Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Handler:      c.Handler(r),
		Addr:         fmt.Sprintf(":%s", port),
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("✅ GeoTrack API listening on http://localhost:%s", port)
	log.Printf("📡 WebSocket endpoint: ws://localhost:%s/ws/alerts", port)
	log.Printf("❤️  Health check:       http://localhost:%s/health", port)
	log.Fatal(srv.ListenAndServe())
}
