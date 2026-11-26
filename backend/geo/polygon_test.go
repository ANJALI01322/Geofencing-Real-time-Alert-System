package geo

import "testing"

// Unit tests for PointInPolygon (Ray Casting algorithm)

func TestPointInPolygon_InsideSquare(t *testing.T) {
	// A square: lat 10–20, lng 10–20
	square := [][2]float64{
		{10, 10}, {20, 10}, {20, 20}, {10, 20}, {10, 10},
	}
	if !PointInPolygon(15, 15, square) {
		t.Error("Center point (15,15) should be INSIDE the square")
	}
}

func TestPointInPolygon_OutsideSquare(t *testing.T) {
	square := [][2]float64{
		{10, 10}, {20, 10}, {20, 20}, {10, 20}, {10, 10},
	}
	if PointInPolygon(25, 25, square) {
		t.Error("Point (25,25) should be OUTSIDE the square")
	}
}

func TestPointInPolygon_OnEdge(t *testing.T) {
	square := [][2]float64{
		{10, 10}, {20, 10}, {20, 20}, {10, 20}, {10, 10},
	}
	// Point on the left edge should not cause panic
	_ = PointInPolygon(15, 10, square)
}

func TestPointInPolygon_Triangle(t *testing.T) {
	// Triangle with vertices (lat,lng): (0,0), (0,10), (10,5).
	// Its base runs along lat=0 and the apex is at lat=10, lng=5.
	triangle := [][2]float64{
		{0, 0}, {0, 10}, {10, 5}, {0, 0},
	}
	if !PointInPolygon(2, 5, triangle) {
		t.Error("Point (2,5) should be INSIDE the triangle")
	}
	if !PointInPolygon(9, 5, triangle) {
		t.Error("Point (9,5) is just under the apex and should be INSIDE")
	}
	if PointInPolygon(9, 9, triangle) {
		t.Error("Point (9,9) is far to the side of the apex and should be OUTSIDE")
	}
}

func TestGeofenceStatus_Entry(t *testing.T) {
	if s := GeofenceStatus(false, true); s != "entry" {
		t.Errorf("Expected 'entry', got '%s'", s)
	}
}

func TestGeofenceStatus_Exit(t *testing.T) {
	if s := GeofenceStatus(true, false); s != "exit" {
		t.Errorf("Expected 'exit', got '%s'", s)
	}
}

func TestGeofenceStatus_NoChange(t *testing.T) {
	if s := GeofenceStatus(true, true); s != "" {
		t.Errorf("Expected '', got '%s'", s)
	}
	if s := GeofenceStatus(false, false); s != "" {
		t.Errorf("Expected '', got '%s'", s)
	}
}

// ── Additional tests: edges, concave shapes, degenerate input, transitions ──

var testSquare = [][2]float64{{10, 10}, {20, 10}, {20, 20}, {10, 20}, {10, 10}}

// The ray-casting implementation treats polygon boundaries as half-open:
// points on the minimum (lower/left) edges are inside, points on the maximum
// (upper/right) edges are outside. These cases pin that behaviour so a change
// is noticed. A vehicle can therefore never be "inside" and "outside" at once.
func TestPointInPolygon_EdgesAndVertices(t *testing.T) {
	cases := []struct {
		name     string
		lat, lng float64
		want     bool
	}{
		{"center", 15, 15, true},
		{"min-lng edge", 15, 10, true},
		{"max-lng edge", 15, 20, false},
		{"min-lat edge", 10, 15, true},
		{"max-lat edge", 20, 15, false},
		{"min corner vertex", 10, 10, true},
		{"max corner vertex", 20, 20, false},
		{"just outside min-lat", 9.9999, 15, false},
		{"just inside min-lng", 15, 10.0001, true},
		{"just inside max-lng", 15, 19.9999, true},
	}
	for _, c := range cases {
		if got := PointInPolygon(c.lat, c.lng, testSquare); got != c.want {
			t.Errorf("%s: PointInPolygon(%v,%v) = %v, want %v", c.name, c.lat, c.lng, got, c.want)
		}
	}
}

func TestPointInPolygon_ConcaveShape(t *testing.T) {
	// "L" shaped polygon
	l := [][2]float64{{0, 0}, {0, 10}, {5, 10}, {5, 5}, {10, 5}, {10, 0}, {0, 0}}
	cases := []struct {
		lat, lng float64
		want     bool
	}{
		{2, 2, true},  // corner of the L
		{7, 2, true},  // tall arm
		{2, 8, true},  // wide arm
		{7, 7, false}, // the notch cut out of the L
		{8, 8, false}, // outside, beyond the notch
	}
	for _, c := range cases {
		if got := PointInPolygon(c.lat, c.lng, l); got != c.want {
			t.Errorf("L-shape (%v,%v) = %v, want %v", c.lat, c.lng, got, c.want)
		}
	}
}

func TestPointInPolygon_DegeneratePolygon(t *testing.T) {
	if PointInPolygon(1, 1, nil) {
		t.Error("nil polygon must never contain a point")
	}
	if PointInPolygon(1, 1, [][2]float64{{0, 0}, {1, 1}}) {
		t.Error("a polygon with fewer than 3 vertices must never contain a point")
	}
}

// Walks a vehicle across the square and checks the exact sequence of events
// produced by PointInPolygon + GeofenceStatus: entry once, exit once.
func TestTransitions_PathAcrossGeofence(t *testing.T) {
	path := [][2]float64{{5, 15}, {8, 15}, {12, 15}, {15, 15}, {18, 15}, {22, 15}, {25, 15}}
	want := []string{"", "", "entry", "", "", "exit", ""}

	wasInside := PointInPolygon(path[0][0], path[0][1], testSquare)
	for i := 1; i < len(path); i++ {
		isInside := PointInPolygon(path[i][0], path[i][1], testSquare)
		if got := GeofenceStatus(wasInside, isInside); got != want[i] {
			t.Errorf("step %d at %v: got %q, want %q", i, path[i], got, want[i])
		}
		wasInside = isInside
	}
}

func TestGeofenceStatus_Table(t *testing.T) {
	cases := []struct {
		was, is bool
		want    string
	}{
		{false, false, ""},
		{false, true, "entry"},
		{true, false, "exit"},
		{true, true, ""},
	}
	for _, c := range cases {
		if got := GeofenceStatus(c.was, c.is); got != c.want {
			t.Errorf("GeofenceStatus(%v,%v) = %q, want %q", c.was, c.is, got, c.want)
		}
	}
}
