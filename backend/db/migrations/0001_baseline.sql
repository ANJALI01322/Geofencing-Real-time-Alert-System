-- 0001_baseline: the schema as it existed before versioned migrations.
--
-- Every statement is idempotent. On a fresh database it creates the whole schema; on a database
-- created by an earlier release (production already has these tables) it changes nothing except
-- the "legacy upgrade" block at the bottom, which brings older violations tables up to date.

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

-- geofence_id is nullable and event_type allows 'speed_violation': speed events have no zone.
CREATE TABLE IF NOT EXISTS violations (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID             NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id UUID             REFERENCES geofences(id) ON DELETE CASCADE,
    event_type  VARCHAR(20)      NOT NULL,
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

-- Legacy upgrade (no-op on a fresh database): earlier releases created violations with
-- VARCHAR(10), a NOT NULL geofence_id and an entry/exit-only CHECK, then patched it at startup.
ALTER TABLE violations ALTER COLUMN event_type TYPE VARCHAR(20);
ALTER TABLE violations ALTER COLUMN geofence_id DROP NOT NULL;
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_event_type_check;
ALTER TABLE violations ADD CONSTRAINT violations_event_type_check
    CHECK (event_type IN ('entry','exit','speed_violation'));
