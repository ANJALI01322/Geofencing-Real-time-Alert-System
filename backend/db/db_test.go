package db

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestEmbeddedMigrationsAreValid(t *testing.T) {
	ms, err := LoadMigrations(migrationFS, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	if len(ms) < 3 {
		t.Fatalf("expected at least the 3 shipped migrations, got %d", len(ms))
	}
	for i, m := range ms {
		if m.Version != i+1 {
			t.Errorf("versions must be contiguous from 1: position %d has version %d", i, m.Version)
		}
		if strings.TrimSpace(m.SQL) == "" {
			t.Errorf("migration %04d_%s is empty", m.Version, m.Name)
		}
		// Each migration runs inside a transaction, where CONCURRENTLY is not allowed.
		if strings.Contains(strings.ToUpper(m.SQL), "CONCURRENTLY") {
			t.Errorf("migration %04d_%s uses CONCURRENTLY, which cannot run in a transaction", m.Version, m.Name)
		}
	}
}

func TestEmbeddedMigrationsCoverTheSchema(t *testing.T) {
	ms, _ := LoadMigrations(migrationFS, "migrations")
	var all strings.Builder
	for _, m := range ms {
		all.WriteString(m.SQL)
	}
	sql := all.String()
	for _, want := range []string{
		"CREATE TABLE IF NOT EXISTS users",
		"password_hash",
		"CHECK (role IN ('admin', 'viewer'))",
		"ON violations(event_type",
		"ON vehicle_locations(vehicle_id, timestamp DESC)",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("migrations are missing %q", want)
		}
	}
}

func TestLoadMigrations_SortsByVersion(t *testing.T) {
	fsys := fstest.MapFS{
		"m/0010_later.sql":  {Data: []byte("SELECT 10;")},
		"m/0002_second.sql": {Data: []byte("SELECT 2;")},
		"m/0001_first.sql":  {Data: []byte("SELECT 1;")},
	}
	ms, err := LoadMigrations(fsys, "m")
	if err != nil {
		t.Fatal(err)
	}
	got := []int{ms[0].Version, ms[1].Version, ms[2].Version}
	if got[0] != 1 || got[1] != 2 || got[2] != 10 {
		t.Errorf("not sorted by version: %v", got)
	}
	if ms[0].Name != "first" || ms[0].SQL != "SELECT 1;" {
		t.Errorf("wrong content: %+v", ms[0])
	}
}

func TestLoadMigrations_RejectsBadNames(t *testing.T) {
	for _, name := range []string{"1_short.sql", "0001-dash.sql", "0001_Upper.sql", "init.sql", "0001_noext", "0001_x.txt"} {
		fsys := fstest.MapFS{"m/" + name: {Data: []byte("SELECT 1;")}}
		if _, err := LoadMigrations(fsys, "m"); err == nil {
			t.Errorf("%q should be rejected", name)
		}
	}
}

func TestLoadMigrations_RejectsDuplicateVersions(t *testing.T) {
	fsys := fstest.MapFS{
		"m/0001_a.sql": {Data: []byte("SELECT 1;")},
		"m/0001_b.sql": {Data: []byte("SELECT 2;")},
	}
	if _, err := LoadMigrations(fsys, "m"); err == nil {
		t.Fatal("two files with the same version must be rejected")
	}
}

func TestParseRetentionDays(t *testing.T) {
	cases := []struct {
		in       string
		want     int
		wantWarn bool
	}{
		{"", 7, false},
		{"  ", 7, false},
		{"30", 30, false},
		{"1", 1, false},
		{"0", 0, false}, // disabled
		{"-3", 7, true},
		{"abc", 7, true},
		{"7.5", 7, true},
	}
	for _, c := range cases {
		got, warn := ParseRetentionDays(c.in)
		if got != c.want || (warn != "") != c.wantWarn {
			t.Errorf("ParseRetentionDays(%q) = %d, %q; want %d (warn=%v)", c.in, got, warn, c.want, c.wantWarn)
		}
	}
}
