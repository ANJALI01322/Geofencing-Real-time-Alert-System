#!/bin/bash
# GeoTrack API smoke test.
#
#   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ./test-api.sh [base-url]
#
# Signs in as the admin, then walks through the main endpoints. Needs curl and python3.
set -e
BASE="${1:-http://localhost:8080}"

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "Set ADMIN_EMAIL and ADMIN_PASSWORD (the account the API was started with)." >&2
  exit 1
fi

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }
call() { curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

echo "=== GeoTrack API Tests ($BASE) ==="

echo -e "\n[1] Health check (public)"
curl -s "$BASE/health" | python3 -m json.tool

echo -e "\n[2] Without a token the API answers 401"
curl -s -o /dev/null -w "GET /vehicles -> HTTP %{http_code}\n" "$BASE/vehicles"

echo -e "\n[3] Sign in"
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json "d['data']['token']")
echo "Signed in (token ${#TOKEN} chars)"
call "$BASE/auth/me" | python3 -m json.tool

echo -e "\n[4] Register a vehicle"
PLATE="TEST$(date +%s | tail -c 7)"
V=$(call -X POST "$BASE/vehicles" \
  -d "{\"vehicle_number\":\"$PLATE\",\"vehicle_type\":\"truck\",\"driver_name\":\"Test Driver\",\"phone_number\":\"9000000000\"}")
echo "$V" | python3 -m json.tool
VID=$(echo "$V" | json "d['data']['vehicle_id']")

echo -e "\n[5] Validation: latitude out of range -> 400"
call -X POST "$BASE/vehicles/location" -d "{\"vehicle_id\":\"$VID\",\"latitude\":123,\"longitude\":77}" | python3 -m json.tool

echo -e "\n[6] Create a geofence (Greater Noida sector)"
GF=$(call -X POST "$BASE/geofences" -d '{
    "name": "GN Warehouse Alpha",
    "category": "restricted_zone",
    "description": "Main warehouse zone",
    "coordinates": [[28.4595, 77.0266],[28.4650, 77.0266],[28.4650, 77.0330],[28.4595, 77.0330],[28.4595, 77.0266]]
  }')
echo "$GF" | python3 -m json.tool
GID=$(echo "$GF" | json "d['data']['geofence_id'] if 'geofence_id' in d['data'] else d['data']['id']")

echo -e "\n[7] Configure an alert rule"
call -X POST "$BASE/alerts/configure" -d "{\"geofence_id\":\"$GID\",\"event_type\":\"both\"}" | python3 -m json.tool

echo -e "\n[8] Location update 1 (outside the zone)"
call -X POST "$BASE/vehicles/location" -d "{\"vehicle_id\":\"$VID\",\"latitude\":28.4700,\"longitude\":77.0400}" | python3 -m json.tool
sleep 3

echo -e "\n[9] Location update 2 (inside the zone -> ENTRY alert)"
call -X POST "$BASE/vehicles/location" -d "{\"vehicle_id\":\"$VID\",\"latitude\":28.4620,\"longitude\":77.0300}" | python3 -m json.tool
sleep 2

echo -e "\n[10] Latest position and zones the vehicle is inside"
call "$BASE/vehicles/location/$VID" | python3 -m json.tool

echo -e "\n[11] Violation history, page 1 of 5 rows (note total / has_more)"
call "$BASE/violations/history?limit=5&offset=0" | python3 -m json.tool

echo -e "\n[12] Totals and per-zone / per-vehicle summary"
call "$BASE/violations/stats" | python3 -m json.tool
call "$BASE/violations/summary" | python3 -m json.tool | head -20

echo -e "\n=== Done ==="
