package auth

import (
	"database/sql"
	"fmt"
	"log"
	"net/mail"
	"os"
	"strings"
)

// MinPasswordLen is the shortest password accepted for seeded accounts.
const MinPasswordLen = 8

// NormalizeEmail trims and lower-cases an email, and checks it is a plain address.
func NormalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || len(email) > 254 {
		return "", fmt.Errorf("invalid email address")
	}
	return email, nil
}

// SeedUsers creates the bootstrap accounts from the environment, only when they do not exist yet:
//
//	ADMIN_EMAIL / ADMIN_PASSWORD                  → role admin
//	DEMO_VIEWER_EMAIL / DEMO_VIEWER_PASSWORD      → role viewer (read-only demo user)
//
// An existing account is never modified, so changing the env var later does not reset a password.
// Passwords are never logged.
func SeedUsers(db *sql.DB) {
	seed(db, "admin", os.Getenv("ADMIN_EMAIL"), os.Getenv("ADMIN_PASSWORD"), RoleAdmin)
	seed(db, "demo viewer", os.Getenv("DEMO_VIEWER_EMAIL"), os.Getenv("DEMO_VIEWER_PASSWORD"), RoleViewer)

	var admins int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&admins); err == nil && admins == 0 {
		log.Println("⚠️  No admin user exists — set ADMIN_EMAIL and ADMIN_PASSWORD so someone can sign in and make changes")
	}
}

func seed(db *sql.DB, label, email, password, role string) {
	if email == "" && password == "" {
		return // not configured
	}
	email, err := NormalizeEmail(email)
	if err != nil {
		log.Printf("⚠️  Skipping %s seed: the configured email is not a valid address", label)
		return
	}
	if len(password) < MinPasswordLen {
		log.Printf("⚠️  Skipping %s seed: the configured password must be at least %d characters", label, MinPasswordLen)
		return
	}
	hash, err := HashPassword(password)
	if err != nil {
		log.Printf("⚠️  Skipping %s seed: could not hash the password", label)
		return
	}
	res, err := db.Exec(`
		INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
		ON CONFLICT (email) DO NOTHING`, email, hash, role)
	if err != nil {
		log.Printf("⚠️  Could not seed %s account: %v", label, err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("✅ Created %s account", label)
	} else {
		log.Printf("ℹ️  %s account already exists — left unchanged", label)
	}
}
