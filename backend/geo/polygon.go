// Package geo provides geospatial utilities for GeoTrack.
package geo

// PointInPolygon determines whether the point (lat, lng) lies inside
// the given polygon using the Ray Casting algorithm.
//
// Coordinates are stored as [latitude, longitude] pairs.
// The polygon must be closed (first point == last point).
//
// Algorithm:
//   Cast an imaginary horizontal ray from the test point to the right.
//   Count how many edges of the polygon the ray crosses.
//   Odd  → point is INSIDE  the polygon.
//   Even → point is OUTSIDE the polygon.
func PointInPolygon(lat, lng float64, polygon [][2]float64) bool {
	n := len(polygon)
	if n < 3 {
		return false
	}

	inside := false
	j := n - 1 // previous vertex index

	for i := 0; i < n; i++ {
		// Current vertex: polygon[i] = [latitude, longitude]
		iLat, iLng := polygon[i][0], polygon[i][1]
		// Previous vertex
		jLat, jLng := polygon[j][0], polygon[j][1]

		// Check if the horizontal ray from (lat, lng) crosses this edge.
		// Condition 1: the edge straddles the horizontal line at our latitude.
		// Condition 2: our longitude is to the LEFT of the intersection point.
		if (iLat > lat) != (jLat > lat) {
			// Calculate the longitude where the edge crosses our latitude
			intersectLng := iLng + (lat-iLat)/(jLat-iLat)*(jLng-iLng)
			if lng < intersectLng {
				inside = !inside
			}
		}
		j = i
	}

	return inside
}

// GeofenceStatus returns the entry/exit transition for a vehicle.
// wasInside: was the vehicle inside before?
// isInside:  is the vehicle inside now?
// Returns "entry", "exit", or "" (no change).
func GeofenceStatus(wasInside, isInside bool) string {
	switch {
	case !wasInside && isInside:
		return "entry"
	case wasInside && !isInside:
		return "exit"
	default:
		return ""
	}
}
