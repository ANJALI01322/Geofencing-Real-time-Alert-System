#!/bin/bash
# GeoTrack API Test Script
BASE="http://localhost:8080"
echo "=== GeoTrack API Tests ==="

echo -e "\n[1] Health Check"
curl -s "$BASE/health" | python3 -m json.tool

echo -e "\n[2] Create Vehicle"
V=$(curl -s -X POST "$BASE/vehicles" -H "Content-Type: application/json" \
  -d '{"vehicle_number":"MH01AB9999","vehicle_type":"truck","driver_name":"Ravi Kumar","driver_phone":"+91 9876543210"}')
echo $V | python3 -m json.tool
VID=$(echo $V | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['vehicle_id'])" 2>/dev/null)
echo "Vehicle ID: $VID"

echo -e "\n[3] List Vehicles"
curl -s "$BASE/vehicles" | python3 -m json.tool

echo -e "\n[4] Create Geofence (Greater Noida sector)"
GF=$(curl -s -X POST "$BASE/geofences" -H "Content-Type: application/json" \
  -d '{
    "geofence_name": "GN Warehouse Alpha",
    "category": "warehouse",
    "description": "Main warehouse zone",
    "coordinates": [
      [28.4595, 77.0266],
      [28.4650, 77.0266],
      [28.4650, 77.0330],
      [28.4595, 77.0330],
      [28.4595, 77.0266]
    ]
  }')
echo $GF | python3 -m json.tool
GID=$(echo $GF | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['geofence_id'])" 2>/dev/null)
echo "Geofence ID: $GID"

echo -e "\n[5] Configure Alert Rule"
curl -s -X POST "$BASE/alerts/configure" -H "Content-Type: application/json" \
  -d "{\"geofence_id\":\"$GID\",\"event_type\":\"both\"}" | python3 -m json.tool

echo -e "\n[6] Update Location - INSIDE Geofence (triggers ENTRY alert)"
curl -s -X POST "$BASE/vehicles/location" -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":\"$VID\",\"latitude\":28.4620,\"longitude\":77.0300,\"speed\":35.0}" | python3 -m json.tool
sleep 1

echo -e "\n[7] Update Location - OUTSIDE Geofence (triggers EXIT alert)"
curl -s -X POST "$BASE/vehicles/location" -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":\"$VID\",\"latitude\":28.4700,\"longitude\":77.0400,\"speed\":60.0}" | python3 -m json.tool
sleep 1

echo -e "\n[8] Get Vehicle Location & Active Geofences"
curl -s "$BASE/vehicles/location/$VID" | python3 -m json.tool

echo -e "\n[9] List Alerts"
curl -s "$BASE/alerts" | python3 -m json.tool

echo -e "\n[10] Violation History"
curl -s "$BASE/violations/history?limit=5" | python3 -m json.tool

echo -e "\n=== Done! WebSocket alerts were broadcast for each geofence transition ==="
