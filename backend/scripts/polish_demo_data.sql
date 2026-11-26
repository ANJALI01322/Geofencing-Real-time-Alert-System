-- polish_demo_data.sql
-- Replaces test/placeholder names in the demo database with realistic ones.
--
-- * Geofences: only `name` changes. category, coordinates and description stay as they are.
-- * Vehicles: only `driver_name`, `vehicle_number` and `phone_number` change. violations, alert_rules and
--   vehicle_locations reference vehicles(id), so history stays attached.
--
-- Every UPDATE matches on BOTH the row id AND its current value. A row that is missing,
-- or was already renamed, matches nothing and is skipped (UPDATE 0); nothing else is touched.
-- The script can therefore be run more than once without side effects.

BEGIN;

-- ── 1. Geofence names ───────────────────────────────────────────────────────
UPDATE geofences SET name = 'Delhi Customer Hub',              updated_at = NOW()
 WHERE id = 'dde7128a-e99f-436e-80bf-946854bf32c7' AND name = 'leet';

UPDATE geofences SET name = 'North Delhi Service Area',        updated_at = NOW()
 WHERE id = '053546cd-b71a-44ba-aa3d-734cefe6c6ca' AND name = 'timeout';

UPDATE geofences SET name = 'Connaught Place Restricted Zone', updated_at = NOW()
 WHERE id = '9334c284-7544-49cb-9de6-5802c0068faf' AND name = 'Reastricted Zone A';

-- Two zones are both shown as "Restricted Zone A" (the second has a double space).
UPDATE geofences SET name = 'Karol Bagh Restricted Zone',      updated_at = NOW()
 WHERE id = 'cf424294-b436-4fe9-88ca-3c111bccadb5' AND name = 'Restricted Zone A';   -- 4 vertices

UPDATE geofences SET name = 'Chanakyapuri Restricted Zone',    updated_at = NOW()
 WHERE id = '31d23e35-8469-45d8-be27-6a5f157f20ca' AND name = 'Restricted Zone  A';  -- 8 vertices

UPDATE geofences SET name = 'Civil Lines Restricted Zone',     updated_at = NOW()
 WHERE id = '53db9b47-3735-42e8-bb6f-f18d3253db72' AND name = 'Restricted Zone B';

-- Lowercase "zone", 19 vertices, located far outside central Delhi.
UPDATE geofences SET name = 'NCR Outer Boundary Zone',         updated_at = NOW()
 WHERE id = '8d6c2b19-ac58-4e13-aa4c-5a7fdd057397' AND name = 'Restricted zone A';

-- ── 2 & 3. Vehicle driver names, registration numbers and phone numbers ──
-- Fictional driver names and placeholder phones; plates follow the Indian format <state><RTO><series><4 digits>.
UPDATE vehicles SET driver_name = 'Rahul Sharma', vehicle_number = 'DL1CAB1234', phone_number = '9000000001', updated_at = NOW()
 WHERE id = '4fb5ef14-f3c2-4b91-8501-578df34f34da' AND vehicle_number = '890AH6534';     -- car

UPDATE vehicles SET driver_name = 'Amit Verma',   vehicle_number = 'DL8CAF5678', phone_number = '9000000002', updated_at = NOW()
 WHERE id = '0da5dad7-99cb-4c0d-a2ec-968a001c7c32' AND vehicle_number = 'DHJLOIYU0987';  -- bus

UPDATE vehicles SET driver_name = 'Priya Singh',  vehicle_number = 'HR26DK4521', phone_number = '9000000003', updated_at = NOW()
 WHERE id = '364f11c6-ed84-401d-bc07-005e842ff024' AND vehicle_number = 'MH12AC5679';    -- bike

UPDATE vehicles SET driver_name = 'Vikram Yadav', vehicle_number = 'UP16BT7788', phone_number = '9000000004', updated_at = NOW()
 WHERE id = '42942418-324e-4090-8c27-05e32a52d976' AND vehicle_number = 'MH12AB5678';    -- truck

UPDATE vehicles SET driver_name = 'Neha Gupta',   vehicle_number = 'DL3CBZ9012', phone_number = '9000000005', updated_at = NOW()
 WHERE id = '5673fa44-c753-4927-8802-15a6eb733810' AND vehicle_number = 'BRO47568';      -- bike

UPDATE vehicles SET driver_name = 'Suresh Kumar', vehicle_number = 'DL1LAC3456', phone_number = '9000000006', updated_at = NOW()
 WHERE id = '8b9052ea-0d03-4e2f-a06a-b8f822f72d13' AND vehicle_number = 'DL01A123';      -- truck

-- Review before COMMIT (visible when run in psql).
SELECT name, category FROM geofences ORDER BY name;
SELECT vehicle_number, driver_name, phone_number, vehicle_type FROM vehicles ORDER BY vehicle_number;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL RUN ONLY. Nothing in the app executes this file automatically.
--
-- Run it yourself against the target database, with the connection string kept in an
-- environment variable (never paste it into a file or commit):
--   psql "$DATABASE_URL" -f backend/scripts/polish_demo_data.sql
--
-- Ids come from the production demo data as of 2026-11-26. On any other database the
-- WHERE clauses match nothing and the script is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════
