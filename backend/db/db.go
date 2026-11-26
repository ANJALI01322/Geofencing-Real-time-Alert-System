// Package db manages the PostgreSQL connection and versioned schema migrations.
package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"regexp"
	"sort"
	"strconv"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// DB is the global database connection pool.
var DB *sql.DB

// Init opens the database connection using DATABASE_URL env variable.
func Init() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=postgres password=postgres dbname=geotrack sslmode=disable"
	}

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)

	// Never print the DSN: it contains the database password.
	if err = DB.Ping(); err != nil {
		log.Fatalf("❌ Cannot connect to database: %v", err)
	}

	log.Println("✅ Database connected successfully")
}

// Close closes the database connection pool.
func Close() {
	if DB != nil {
		DB.Close()
	}
}

//go:embed migrations/*.sql
var migrationFS embed.FS

// migrationLockID is the Postgres advisory-lock key that serialises migration runs, so two
// instances starting at once (a rolling deploy) cannot apply the same migration twice.
const migrationLockID = 727274

// Migration is one versioned SQL file: migrations/NNNN_name.sql.
type Migration struct {
	Version int
	Name    string
	SQL     string
}

var migrationName = regexp.MustCompile(`^(\d{4})_([a-z0-9_]+)\.sql$`)

// LoadMigrations reads and validates the migration files in dir: names must look like
// 0001_something.sql, and versions must be unique. They are returned in version order.
func LoadMigrations(fsys fs.FS, dir string) ([]Migration, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, err
	}
	var out []Migration
	seen := map[int]string{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := migrationName.FindStringSubmatch(e.Name())
		if m == nil {
			return nil, fmt.Errorf("migration file %q must be named NNNN_name.sql", e.Name())
		}
		version, _ := strconv.Atoi(m[1])
		if prev, dup := seen[version]; dup {
			return nil, fmt.Errorf("migration version %04d used twice (%s, %s)", version, prev, e.Name())
		}
		seen[version] = e.Name()
		body, err := fs.ReadFile(fsys, dir+"/"+e.Name())
		if err != nil {
			return nil, err
		}
		out = append(out, Migration{Version: version, Name: m[2], SQL: string(body)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	return out, nil
}

// RunMigrations applies every migration that has not been applied yet, in order. Each one runs
// in its own transaction together with its schema_migrations record, so a failure leaves the
// database at the last good version. The caller should treat an error as fatal.
func RunMigrations() error {
	migrations, err := LoadMigrations(migrationFS, "migrations")
	if err != nil {
		return err
	}
	return Migrate(context.Background(), DB, migrations)
}

// Migrate applies the given migrations to the database.
func Migrate(ctx context.Context, db *sql.DB, migrations []Migration) error {
	// A dedicated connection holds the advisory lock for the whole run.
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("migrations: get connection: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `SELECT pg_advisory_lock($1)`, migrationLockID); err != nil {
		return fmt.Errorf("migrations: acquire lock: %w", err)
	}
	defer conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock($1)`, migrationLockID)

	if _, err := conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER     PRIMARY KEY,
			name       TEXT        NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		return fmt.Errorf("migrations: create schema_migrations: %w", err)
	}

	applied := map[int]bool{}
	rows, err := conn.QueryContext(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("migrations: read applied versions: %w", err)
	}
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err == nil {
			applied[v] = true
		}
	}
	rows.Close()

	count := 0
	for _, m := range migrations {
		if applied[m.Version] {
			continue
		}
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("migration %04d_%s: begin: %w", m.Version, m.Name, err)
		}
		if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %04d_%s failed: %w", m.Version, m.Name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, m.Version, m.Name); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %04d_%s: record: %w", m.Version, m.Name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("migration %04d_%s: commit: %w", m.Version, m.Name, err)
		}
		log.Printf("✅ Applied migration %04d_%s", m.Version, m.Name)
		count++
	}
	if count == 0 {
		log.Println("✅ Database schema is up to date")
	}
	return nil
}
