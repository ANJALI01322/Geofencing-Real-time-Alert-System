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
	// Triangle with vertices at (0,0), (10,0), (5,10)
	triangle := [][2]float64{
		{0, 0}, {0, 10}, {10, 5}, {0, 0},
	}
	if !PointInPolygon(2, 5, triangle) {
		t.Error("Point (2,5) should be INSIDE the triangle")
	}
	if PointInPolygon(9, 5, triangle) {
		t.Error("Point (9,5) should be OUTSIDE the triangle")
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
