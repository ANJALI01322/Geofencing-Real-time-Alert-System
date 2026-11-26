package handlers

import (
	"math"
	"testing"
)

func approx(a, b, tol float64) bool { return math.Abs(a-b) <= tol }

func TestHaversine_ZeroDistance(t *testing.T) {
	if d := haversineMeters(28.6139, 77.2090, 28.6139, 77.2090); d != 0 {
		t.Errorf("same point should be 0 m, got %v", d)
	}
}

func TestHaversine_OneDegreeAtEquator(t *testing.T) {
	// 1 degree of longitude on the equator ≈ 111.195 km
	d := haversineMeters(0, 0, 0, 1)
	if !approx(d, 111195, 50) {
		t.Errorf("expected ≈111195 m, got %.1f", d)
	}
}

func TestHaversine_Symmetric(t *testing.T) {
	a := haversineMeters(28.6139, 77.2090, 19.0760, 72.8777) // Delhi -> Mumbai
	b := haversineMeters(19.0760, 72.8777, 28.6139, 77.2090)
	if !approx(a, b, 1e-6) {
		t.Errorf("distance should be symmetric: %v vs %v", a, b)
	}
	// Delhi–Mumbai great-circle distance is ≈ 1,150 km
	if !approx(a, 1_150_000, 25_000) {
		t.Errorf("Delhi–Mumbai expected ≈1150 km, got %.0f m", a)
	}
}

func TestSpeedKmh(t *testing.T) {
	cases := []struct {
		name            string
		meters, seconds float64
		want            float64
	}{
		{"1000 m in 36 s = 100 km/h", 1000, 36, 100},
		{"10 m/s = 36 km/h", 100, 10, 36},
		{"stationary", 0, 10, 0},
	}
	for _, c := range cases {
		if got := speedKmh(c.meters, c.seconds); !approx(got, c.want, 1e-9) {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

// End to end: two GPS fixes ~1.11 km apart, 30 s apart => ≈133 km/h,
// which is over the limit but below the "GPS jump" cut-off.
func TestSpeedFromCoordinates(t *testing.T) {
	meters := haversineMeters(0, 0, 0, 0.01) // ≈1112 m
	speed := speedKmh(meters, 30)
	if !approx(speed, 133.4, 1) {
		t.Errorf("expected ≈133 km/h, got %.1f", speed)
	}
	if speed <= speedLimitKmh || speed >= maxPlausibleKmh {
		t.Errorf("speed %.1f should be between the limit (%v) and the GPS-jump cut-off (%v)", speed, speedLimitKmh, maxPlausibleKmh)
	}
}

func TestSpeedThresholdsAreSane(t *testing.T) {
	if !(speedLimitKmh < maxPlausibleKmh) {
		t.Error("speed limit must be below the implausible-speed cut-off")
	}
	if minSpeedSampleSecs <= 0 || speedAlertCooldown <= 0 {
		t.Error("sample window and cooldown must be positive")
	}
}
