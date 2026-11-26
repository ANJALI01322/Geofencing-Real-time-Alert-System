package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
)

// DefaultRetentionDays is how long vehicle_locations rows are kept when RETENTION_DAYS is unset.
const DefaultRetentionDays = 7

const (
	retentionInterval  = time.Hour
	retentionBatchSize = 5000 // delete in chunks so the table is never locked for long
)

// ParseRetentionDays interprets the RETENTION_DAYS env value: empty → 7, a positive number →
// that many days, 0 → retention disabled (keep everything). Anything else falls back to the
// default and returns a warning to log.
func ParseRetentionDays(raw string) (days int, warning string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return DefaultRetentionDays, ""
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return DefaultRetentionDays, fmt.Sprintf("RETENTION_DAYS=%q is not a non-negative integer, using %d", raw, DefaultRetentionDays)
	}
	return n, ""
}

// PurgeOldLocations deletes vehicle_locations older than `days` days and returns how many rows
// it removed. It works in batches and stops early if ctx is cancelled.
func PurgeOldLocations(ctx context.Context, db *sql.DB, days int, now time.Time) (int64, error) {
	cutoff := now.AddDate(0, 0, -days)
	var total int64
	for {
		res, err := db.ExecContext(ctx, `
			DELETE FROM vehicle_locations
			WHERE id IN (SELECT id FROM vehicle_locations WHERE timestamp < $1 LIMIT $2)`,
			cutoff, retentionBatchSize)
		if err != nil {
			return total, err
		}
		n, _ := res.RowsAffected()
		total += n
		if n < retentionBatchSize || ctx.Err() != nil {
			return total, ctx.Err()
		}
	}
}

// StartRetention runs PurgeOldLocations once now and then every hour in a background goroutine,
// until ctx is cancelled. days <= 0 disables it.
func StartRetention(ctx context.Context, db *sql.DB, days int) {
	if days <= 0 {
		log.Println("ℹ️  Location retention disabled (RETENTION_DAYS=0)")
		return
	}
	log.Printf("🧹 Location retention: deleting vehicle_locations older than %d days, checked hourly", days)
	go func() {
		run := func() {
			n, err := PurgeOldLocations(ctx, db, days, time.Now())
			switch {
			case err != nil && ctx.Err() == nil:
				log.Printf("⚠️  Retention purge failed: %v", err)
			case n > 0:
				log.Printf("🧹 Retention purge removed %d old location rows", n)
			}
		}
		run()
		t := time.NewTicker(retentionInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				run()
			}
		}
	}()
}
