package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"geotrack/apierr"
)

func TestValidateLatLng(t *testing.T) {
	good := [][2]float64{{0, 0}, {90, 180}, {-90, -180}, {28.6139, 77.2090}}
	for _, c := range good {
		if err := validateLatLng(c[0], c[1]); err != nil {
			t.Errorf("(%v, %v) should be valid: %v", c[0], c[1], err)
		}
	}
	bad := [][2]float64{{90.0001, 0}, {-90.0001, 0}, {0, 180.0001}, {0, -180.0001}, {91, 200}}
	for _, c := range bad {
		if err := validateLatLng(c[0], c[1]); err == nil {
			t.Errorf("(%v, %v) should be rejected", c[0], c[1])
		}
	}
}

func TestValidateVehicle(t *testing.T) {
	v, err := validateVehicle("  DL1CAB1234 ", " Rahul Sharma ", " truck ", " 9000000001 ")
	if err != nil {
		t.Fatal(err)
	}
	if v.Number != "DL1CAB1234" || v.Driver != "Rahul Sharma" || v.Type != "truck" || v.Phone != "9000000001" {
		t.Errorf("fields must be trimmed, got %+v", v)
	}

	// A phone number is optional.
	if _, err := validateVehicle("DL1CAB1234", "Rahul", "truck", ""); err != nil {
		t.Errorf("empty phone should be allowed: %v", err)
	}

	bad := []struct{ name, num, drv, typ, phone string }{
		{"empty number", "", "Rahul", "truck", ""},
		{"whitespace-only number", "   ", "Rahul", "truck", ""},
		{"empty driver", "DL1", "", "truck", ""},
		{"empty type", "DL1", "Rahul", "  ", ""},
		{"number too long", strings.Repeat("A", 51), "Rahul", "truck", ""},
		{"driver too long", "DL1", strings.Repeat("a", 101), "truck", ""},
		{"phone too long", "DL1", "Rahul", "truck", strings.Repeat("9", 21)},
	}
	for _, c := range bad {
		if _, err := validateVehicle(c.num, c.drv, c.typ, c.phone); err == nil {
			t.Errorf("%s: should be rejected", c.name)
		}
	}
}

func TestValidatePolygon(t *testing.T) {
	tri := [][2]float64{{28.60, 77.20}, {28.60, 77.22}, {28.62, 77.21}, {28.60, 77.20}}
	if err := validatePolygon(tri); err != nil {
		t.Errorf("a closed triangle (3 vertices) is valid: %v", err)
	}

	cases := map[string][][2]float64{
		"empty":               {},
		"two vertices":        {{1, 1}, {2, 2}, {1, 1}},
		"not closed":          {{28.60, 77.20}, {28.60, 77.22}, {28.62, 77.21}, {28.63, 77.25}},
		"latitude too high":   {{91, 77}, {28, 77}, {28, 78}, {91, 77}},
		"longitude too low":   {{28, -181}, {28, 77}, {29, 77}, {28, -181}},
		"bad vertex mid-ring": {{28, 77}, {28, 78}, {95, 78}, {28, 77}},
	}
	for name, c := range cases {
		if err := validatePolygon(c); err == nil {
			t.Errorf("%s: should be rejected", name)
		}
	}
}

func TestIsUUID(t *testing.T) {
	for _, s := range []string{"4fb5ef14-f3c2-4b91-8501-578df34f34da", "4FB5EF14-F3C2-4B91-8501-578DF34F34DA"} {
		if !isUUID(s) {
			t.Errorf("%q should be a UUID", s)
		}
	}
	for _, s := range []string{"", "abc", "4fb5ef14f3c24b918501578df34f34da", "4fb5ef14-f3c2-4b91-8501-578df34f34d", "'; DROP TABLE users;--"} {
		if isUUID(s) {
			t.Errorf("%q must not be a UUID", s)
		}
	}
}

func TestEventTypeWhitelists(t *testing.T) {
	for _, s := range []string{"entry", "exit", "speed_violation"} {
		if !violationEventTypes[s] {
			t.Errorf("violation filter should accept %q", s)
		}
	}
	for _, s := range []string{"", "both", "ENTRY", "speed", "entry; DROP TABLE violations"} {
		if violationEventTypes[s] {
			t.Errorf("violation filter must reject %q", s)
		}
	}
	for _, s := range []string{"entry", "exit", "both"} {
		if !alertEventTypes[s] {
			t.Errorf("alert rules should accept %q", s)
		}
	}
	if alertEventTypes["speed_violation"] {
		t.Error("alert rules do not accept speed_violation")
	}
}

func TestParseTimeParam(t *testing.T) {
	if got, err := parseTimeParam("2026-11-26T10:30:00Z", false); err != nil || !got.Equal(time.Date(2026, 11, 26, 10, 30, 0, 0, time.UTC)) {
		t.Errorf("RFC 3339: %v %v", got, err)
	}
	start, _ := parseTimeParam("2026-11-26", false)
	end, _ := parseTimeParam("2026-11-26", true)
	if !start.Equal(time.Date(2026, 11, 26, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("date-only start should be midnight, got %v", start)
	}
	if end.Day() != 26 || end.Hour() != 23 || end.Minute() != 59 {
		t.Errorf("date-only end should be the last instant of that day, got %v", end)
	}
	for _, bad := range []string{"yesterday", "26-11-2026", "2026-13-40", "1; DROP TABLE x"} {
		if _, err := parseTimeParam(bad, false); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

// ── error envelope ───────────────────────────────────────────────────────────

func TestRespondError_Envelope(t *testing.T) {
	h := &Handler{}
	cases := []struct {
		status int
		code   string
	}{
		{400, apierr.CodeValidation},
		{401, apierr.CodeUnauthorized},
		{403, apierr.CodeForbidden},
		{404, apierr.CodeNotFound},
		{409, apierr.CodeConflict},
		{413, apierr.CodePayloadTooLarge},
		{429, apierr.CodeRateLimited},
		{500, apierr.CodeInternal},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.respondError(rec, c.status, "details here", time.Now())
		if rec.Code != c.status {
			t.Errorf("status: got %d want %d", rec.Code, c.status)
		}
		var b apierr.Body
		if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil {
			t.Fatalf("%d: not JSON: %v", c.status, err)
		}
		if b.Error.Code != c.code {
			t.Errorf("%d: code %q, want %q", c.status, b.Error.Code, c.code)
		}
		if c.status < 500 && b.Error.Message != "details here" {
			t.Errorf("%d: message %q should pass through", c.status, b.Error.Message)
		}
		if c.status >= 500 && strings.Contains(b.Error.Message, "details here") {
			t.Errorf("%d: internal details must not reach the client", c.status)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
			t.Errorf("content type %q", ct)
		}
	}
}

func TestDecodeJSON(t *testing.T) {
	h := &Handler{}
	var dst struct {
		Name string `json:"name"`
	}

	rec := httptest.NewRecorder()
	if !h.decodeJSON(rec, httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"x"}`)), &dst) || dst.Name != "x" {
		t.Fatal("valid JSON should decode")
	}

	rec = httptest.NewRecorder()
	if h.decodeJSON(rec, httptest.NewRequest("POST", "/", strings.NewReader(`{not json`)), &dst) {
		t.Fatal("malformed JSON should fail")
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("malformed JSON: want 400, got %d", rec.Code)
	}

	big := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"`+strings.Repeat("a", 100)+`"}`))
	rec = httptest.NewRecorder()
	big.Body = http.MaxBytesReader(rec, big.Body, 20)
	if h.decodeJSON(rec, big, &dst) {
		t.Fatal("oversized body should fail")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized body: want 413, got %d", rec.Code)
	}
}

// ── pagination & query building ──────────────────────────────────────────────

func TestParsePagination(t *testing.T) {
	cases := []struct {
		query       string
		limit, offs int
		wantErr     bool
	}{
		{"", 50, 0, false},
		{"limit=10", 10, 0, false},
		{"limit=100", 100, 0, false},
		{"limit=500", 100, 0, false}, // capped, not rejected
		{"limit=10&offset=30", 10, 30, false},
		{"offset=0", 50, 0, false},
		{"limit=0", 0, 0, true},
		{"limit=-5", 0, 0, true},
		{"limit=abc", 0, 0, true},
		{"offset=-1", 0, 0, true},
		{"offset=1.5", 0, 0, true},
	}
	for _, c := range cases {
		q, _ := url.ParseQuery(c.query)
		limit, offset, err := parsePagination(q)
		if (err != nil) != c.wantErr {
			t.Errorf("%q: err=%v, wantErr=%v", c.query, err, c.wantErr)
			continue
		}
		if !c.wantErr && (limit != c.limit || offset != c.offs) {
			t.Errorf("%q: got limit=%d offset=%d, want %d/%d", c.query, limit, offset, c.limit, c.offs)
		}
	}
}

func TestBuildViolationsQuery_NoFilters(t *testing.T) {
	q, args := buildViolationsQuery(violationFilter{}, 50, 100)
	if len(args) != 2 || args[0] != 50 || args[1] != 100 {
		t.Fatalf("args = %v, want [50 100]", args)
	}
	for _, want := range []string{"LIMIT $1 OFFSET $2", "ORDER BY v.timestamp DESC, v.id DESC"} {
		if !strings.Contains(q, want) {
			t.Errorf("query missing %q:\n%s", want, q)
		}
	}
}

func TestBuildViolationsQuery_AllFilters(t *testing.T) {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	f := violationFilter{VehicleID: "vid", GeofenceID: "gid", EventType: "entry", From: &from, To: &to}

	q, args := buildViolationsQuery(f, 25, 75)
	if len(args) != 7 {
		t.Fatalf("want 5 filter args + limit + offset, got %d: %v", len(args), args)
	}
	for i, want := range []string{"v.vehicle_id = $1", "v.geofence_id = $2", "v.event_type = $3", "v.timestamp >= $4", "v.timestamp <= $5", "LIMIT $6 OFFSET $7"} {
		if !strings.Contains(q, want) {
			t.Errorf("#%d: query missing %q:\n%s", i, want, q)
		}
	}
	if args[5] != 25 || args[6] != 75 {
		t.Errorf("limit/offset args wrong: %v", args[5:])
	}
	// Values travel as bind parameters, never inside the SQL text.
	for _, leak := range []string{"vid", "gid", "'entry'"} {
		if strings.Contains(q, leak) {
			t.Errorf("filter value %q leaked into the SQL text", leak)
		}
	}
}

func TestBuildViolationsCount_UsesTheSameFilters(t *testing.T) {
	to := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	f := violationFilter{EventType: "exit", To: &to}

	pageSQL, pageArgs := buildViolationsQuery(f, 10, 0)
	countSQL, countArgs := buildViolationsCount(f)

	if !strings.HasPrefix(countSQL, "SELECT COUNT(*) FROM violations v") {
		t.Errorf("count query: %s", countSQL)
	}
	if strings.Contains(countSQL, "LIMIT") || strings.Contains(countSQL, "OFFSET") {
		t.Error("the total must ignore pagination")
	}
	// total must reflect the same WHERE clause as the page (including the date filter).
	whereOf := func(s string) string { i := strings.Index(s, "WHERE"); return s[i:] }
	if !strings.HasPrefix(whereOf(pageSQL), whereOf(countSQL)) {
		t.Errorf("page and count WHERE clauses differ:\n%s\n%s", whereOf(pageSQL), whereOf(countSQL))
	}
	if len(countArgs) != 2 || countArgs[0] != "exit" || len(pageArgs) != 4 {
		t.Errorf("args: count=%v page=%v", countArgs, pageArgs)
	}
}

func TestParseViolationFilter(t *testing.T) {
	const id = "4fb5ef14-f3c2-4b91-8501-578df34f34da"

	q, _ := url.ParseQuery("vehicle_id=" + id + "&geofence_id=" + id + "&event_type=speed_violation&start_date=2026-01-01&end_date=2026-01-31")
	f, err := parseViolationFilter(q)
	if err != nil {
		t.Fatal(err)
	}
	if f.VehicleID != id || f.EventType != "speed_violation" || f.From == nil || f.To == nil {
		t.Errorf("filter not populated: %+v", f)
	}

	bad := []string{
		"vehicle_id=nope",
		"geofence_id=1",
		"event_type=both",
		"event_type=ENTRY",
		"start_date=yesterday",
		"end_date=2026-99-99",
	}
	for _, s := range bad {
		q, _ := url.ParseQuery(s)
		if _, err := parseViolationFilter(q); err == nil {
			t.Errorf("%q should be rejected", s)
		}
	}
}
