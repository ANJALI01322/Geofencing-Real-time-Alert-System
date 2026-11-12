-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    driver_name    VARCHAR(100) NOT NULL,
    vehicle_type   VARCHAR(50) NOT NULL,
    phone_number   VARCHAR(20) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

-- Geofences table
CREATE TABLE IF NOT EXISTS geofences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    coordinates JSONB NOT NULL,
    category    VARCHAR(50) NOT NULL CHECK (category IN ('delivery_zone','restricted_zone','toll_zone','customer_area')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geofences_category ON geofences(category);

-- Vehicle locations table
CREATE TABLE IF NOT EXISTS vehicle_locations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude   DOUBLE PRECISION NOT NULL,
    longitude  DOUBLE PRECISION NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_timestamp  ON vehicle_locations(timestamp DESC);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    vehicle_id  UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    event_type  VARCHAR(10) NOT NULL CHECK (event_type IN ('entry','exit','both')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_geofence ON alert_rules(geofence_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_vehicle  ON alert_rules(vehicle_id);

-- Violations (entry/exit events) table
CREATE TABLE IF NOT EXISTS violations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type  VARCHAR(10) NOT NULL CHECK (event_type IN ('entry','exit')),
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_vehicle   ON violations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_violations_geofence  ON violations(geofence_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vehicles_updated_at  ON vehicles;
DROP TRIGGER IF EXISTS geofences_updated_at ON geofences;
CREATE TRIGGER vehicles_updated_at  BEFORE UPDATE ON vehicles  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER geofences_updated_at BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
