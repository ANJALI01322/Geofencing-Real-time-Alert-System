-- 0003_indexes: indexes for the hot read and delete paths.
--
-- The schema's timestamp column is `timestamp` (there is no created_at / recorded_at), and the
-- zone type column is `category`. Already covered by 0001, so not repeated here:
--   violations(timestamp DESC)  -> idx_viol_timestamp
--   violations(vehicle_id)      -> idx_viol_vehicle
--   geofences(category)         -> idx_geofences_category
-- New below:

-- GET /violations/history?event_type=...   (filter + newest-first ordering)
CREATE INDEX IF NOT EXISTS idx_viol_event_type ON violations(event_type, timestamp DESC);

-- GET /violations/history?vehicle_id=...   (filter + newest-first ordering)
CREATE INDEX IF NOT EXISTS idx_viol_vehicle_ts ON violations(vehicle_id, timestamp DESC);

-- "latest position of a vehicle" runs on every location update, and the route history on every
-- playback: both are `WHERE vehicle_id = $1 ORDER BY timestamp DESC LIMIT n`.
CREATE INDEX IF NOT EXISTS idx_vl_vehicle_ts ON vehicle_locations(vehicle_id, timestamp DESC);

-- Redundant now: idx_vl_vehicle is a prefix of idx_vl_vehicle_ts, and idx_vehicles_number
-- duplicates the index behind vehicles.vehicle_number UNIQUE. Dropping them speeds up the
-- constant stream of vehicle_locations inserts.
DROP INDEX IF EXISTS idx_vl_vehicle;
DROP INDEX IF EXISTS idx_vehicles_number;
