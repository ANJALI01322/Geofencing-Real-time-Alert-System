-- ============================================================================
-- GeoTrack demo-data cleanup
--
-- !! RUN THIS MANUALLY !!  It is NOT executed automatically by the backend,
-- migrations, or CI. Run it yourself against the database you intend to clean:
--
--     psql "<DATABASE_URL>" -f backend/scripts/cleanup_demo_data.sql
--
-- What it removes:
--   1. All violations with event_type = 'speed_violation'
--   2. Vehicles whose vehicle_number starts with 'EVAL-'
--   3. Geofences whose name starts with 'EVAL' (case-insensitive)
--   ...plus everything that references those vehicles / geofences.
--
-- Foreign keys (all ON DELETE CASCADE) would clean the child rows on their own,
-- but they are deleted explicitly, children first, so the effect is visible
-- and does not depend on cascade behaviour.
--
-- Everything runs in one transaction. To preview first, run only the SELECTs
-- below, or replace COMMIT with ROLLBACK to dry-run.
-- ============================================================================

-- Preview (optional):
-- SELECT COUNT(*) FROM violations WHERE event_type = 'speed_violation';
-- SELECT id, vehicle_number FROM vehicles  WHERE vehicle_number LIKE 'EVAL-%';
-- SELECT id, name           FROM geofences WHERE name ILIKE 'EVAL%';

BEGIN;

-- 1. Speed-violation rows (the simulator flood)
DELETE FROM violations
WHERE event_type = 'speed_violation';

-- 2. Rows that reference EVAL vehicles / geofences (children first)
DELETE FROM violations
WHERE vehicle_id  IN (SELECT id FROM vehicles  WHERE vehicle_number LIKE 'EVAL-%')
   OR geofence_id IN (SELECT id FROM geofences WHERE name ILIKE 'EVAL%');

DELETE FROM alert_rules
WHERE vehicle_id  IN (SELECT id FROM vehicles  WHERE vehicle_number LIKE 'EVAL-%')
   OR geofence_id IN (SELECT id FROM geofences WHERE name ILIKE 'EVAL%');

DELETE FROM vehicle_locations
WHERE vehicle_id IN (SELECT id FROM vehicles WHERE vehicle_number LIKE 'EVAL-%');

-- 3. The parent rows themselves
DELETE FROM vehicles  WHERE vehicle_number LIKE 'EVAL-%';
DELETE FROM geofences WHERE name ILIKE 'EVAL%';

COMMIT;
