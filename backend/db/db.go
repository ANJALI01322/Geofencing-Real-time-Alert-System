// Package db manages the PostgreSQL connection and schema migrations.
package db

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// DB is the global database connection pool.
var DB *sql.DB

// Init opens the database connection using DATABASE_URL env variable.
func Init() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=postgres password=postgres dbname=geotrack sslmode=disable"
	}

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)

	if err = DB.Ping(); err != nil {
		log.Fatalf("❌ Cannot connect to database: %v\nDSN: %s", err, dsn)
	}

	log.Println("✅ Database connected successfully")
}

// Close closes the database connection pool.
func Close() {
	if DB != nil {
		DB.Close()
	}
}

// RunMigrations applies the SQL migration script embedded below.
// Using IF NOT EXISTS ensures it is safe to run multiple times.
func RunMigrations() {
	_, err := DB.Exec(migrationSQL)
	if err != nil {
		log.Printf("⚠️  Migration warning (may be safe to ignore if tables exist): %v", err)
		return
	}
	log.Println("✅ Database migrations applied")
}

// migrationSQL contains the full schema definition.
const migrationSQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS vehicles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number VARCHAR(50)  UNIQUE NOT NULL,
    driver_name    VARCHAR(100) NOT NULL,
    vehicle_type   VARCHAR(50)  NOT NULL,
    phone_number   VARCHAR(20)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

CREATE TABLE IF NOT EXISTS geofences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    coordinates JSONB        NOT NULL,
    category    VARCHAR(50)  NOT NULL CHECK (category IN ('delivery_zone','restricted_zone','toll_zone','customer_area')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geofences_category ON geofences(category);

CREATE TABLE IF NOT EXISTS vehicle_locations (
    id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID             NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude   DOUBLE PRECISION NOT NULL,
    longitude  DOUBLE PRECISION NOT NULL,
    timestamp  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vl_vehicle   ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vl_timestamp ON vehicle_locations(timestamp DESC);

CREATE TABLE IF NOT EXISTS alert_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID         NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    vehicle_id  UUID         REFERENCES vehicles(id) ON DELETE CASCADE,
    event_type  VARCHAR(10)  NOT NULL CHECK (event_type IN ('entry','exit','both')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ar_geofence ON alert_rules(geofence_id);
CREATE INDEX IF NOT EXISTS idx_ar_vehicle  ON alert_rules(vehicle_id);

CREATE TABLE IF NOT EXISTS violations (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID             NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id UUID             NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type  VARCHAR(10)      NOT NULL CHECK (event_type IN ('entry','exit')),
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    timestamp   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_viol_vehicle   ON violations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_viol_geofence  ON violations(geofence_id);
CREATE INDEX IF NOT EXISTS idx_viol_timestamp ON violations(timestamp DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_vehicles_upd  ON vehicles;
DROP TRIGGER IF EXISTS trig_geofences_upd ON geofences;
CREATE TRIGGER trig_vehicles_upd  BEFORE UPDATE ON vehicles  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_geofences_upd BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`
