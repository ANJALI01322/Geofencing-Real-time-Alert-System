package handlers

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// Field limits mirror the database column sizes, so bad input becomes a 400 rather than a 500.
const (
	maxVehicleNumberLen = 50
	maxDriverNameLen    = 100
	maxVehicleTypeLen   = 50
	maxPhoneLen         = 20
	maxGeofenceNameLen  = 100
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isUUID reports whether s looks like a UUID (Postgres rejects anything else with a 500-level error).
func isUUID(s string) bool { return uuidRe.MatchString(s) }

// validateLatLng checks lat ∈ [-90, 90] and lng ∈ [-180, 180].
func validateLatLng(lat, lng float64) error {
	if math.IsNaN(lat) || math.IsInf(lat, 0) || lat < -90 || lat > 90 {
		return fmt.Errorf("latitude must be between -90 and 90")
	}
	if math.IsNaN(lng) || math.IsInf(lng, 0) || lng < -180 || lng > 180 {
		return fmt.Errorf("longitude must be between -180 and 180")
	}
	return nil
}

// vehicleInput is a validated, trimmed vehicle registration.
type vehicleInput struct {
	Number, Driver, Type, Phone string
}

// validateVehicle trims every field and checks the required ones are present and within limits.
func validateVehicle(number, driver, vtype, phone string) (vehicleInput, error) {
	v := vehicleInput{
		Number: strings.TrimSpace(number),
		Driver: strings.TrimSpace(driver),
		Type:   strings.TrimSpace(vtype),
		Phone:  strings.TrimSpace(phone),
	}
	switch {
	case v.Number == "":
		return v, fmt.Errorf("vehicle_number is required")
	case len(v.Number) > maxVehicleNumberLen:
		return v, fmt.Errorf("vehicle_number must be at most %d characters", maxVehicleNumberLen)
	case v.Driver == "":
		return v, fmt.Errorf("driver_name is required")
	case len(v.Driver) > maxDriverNameLen:
		return v, fmt.Errorf("driver_name must be at most %d characters", maxDriverNameLen)
	case v.Type == "":
		return v, fmt.Errorf("vehicle_type is required")
	case len(v.Type) > maxVehicleTypeLen:
		return v, fmt.Errorf("vehicle_type must be at most %d characters", maxVehicleTypeLen)
	case len(v.Phone) > maxPhoneLen:
		return v, fmt.Errorf("phone_number must be at most %d characters", maxPhoneLen)
	}
	return v, nil
}

// validateGeofenceName trims and checks the zone name.
func validateGeofenceName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("name is required")
	}
	if len(name) > maxGeofenceNameLen {
		return "", fmt.Errorf("name must be at most %d characters", maxGeofenceNameLen)
	}
	return name, nil
}

// validatePolygon checks the polygon invariants:
//  1. At least 3 distinct vertices (a closed ring therefore has at least 4 coordinate pairs)
//  2. The ring is closed (first == last)
//  3. Every vertex has lat ∈ [-90, 90] and lng ∈ [-180, 180]
func validatePolygon(coords [][2]float64) error {
	if len(coords) < 4 {
		return fmt.Errorf("polygon must have at least 3 vertices (got %d coordinate pairs; a closed ring needs 4)", len(coords))
	}
	first, last := coords[0], coords[len(coords)-1]
	if first[0] != last[0] || first[1] != last[1] {
		return fmt.Errorf("polygon must be closed: first and last coordinates must match")
	}
	for i, c := range coords {
		if math.IsNaN(c[0]) || math.IsInf(c[0], 0) || c[0] < -90 || c[0] > 90 {
			return fmt.Errorf("coordinate[%d]: latitude %.6f is out of range [-90, 90]", i, c[0])
		}
		if math.IsNaN(c[1]) || math.IsInf(c[1], 0) || c[1] < -180 || c[1] > 180 {
			return fmt.Errorf("coordinate[%d]: longitude %.6f is out of range [-180, 180]", i, c[1])
		}
	}
	return nil
}

// Event types accepted by the violations filter.
var violationEventTypes = map[string]bool{"entry": true, "exit": true, "speed_violation": true}

// Event types accepted when configuring an alert rule.
var alertEventTypes = map[string]bool{"entry": true, "exit": true, "both": true}

// parseTimeParam accepts RFC 3339 ("2026-11-26T10:00:00Z") or a plain date ("2026-11-26").
// With endOfDay a plain date means the end of that day, so an end_date filter is inclusive.
func parseTimeParam(s string, endOfDay bool) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		if endOfDay {
			t = t.Add(24*time.Hour - time.Nanosecond)
		}
		return t, nil
	}
	return time.Time{}, fmt.Errorf("must be RFC 3339 (2026-11-26T10:00:00Z) or YYYY-MM-DD")
}
