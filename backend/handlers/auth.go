package handlers

import (
	"database/sql"
	"net/http"
	"sync"
	"time"

	"geotrack/apierr"
	"geotrack/auth"
)

// dummyHash is compared against when an email is unknown, so a login for a missing account
// takes as long as one for a real account (no user enumeration by response time).
var (
	dummyOnce sync.Once
	dummyHash string
)

func dummyPasswordHash() string {
	dummyOnce.Do(func() { dummyHash, _ = auth.HashPassword("geotrack-dummy-password") })
	return dummyHash
}

// maxPasswordLen is bcrypt's input limit; longer passwords can never be valid.
const maxPasswordLen = 72

// Login handles POST /auth/login → {data: {token, token_type, expires_in, expires_at, user}}.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !h.decodeJSON(w, r, &req) {
		return
	}
	email, err := auth.NormalizeEmail(req.Email)
	if err != nil || req.Password == "" {
		h.respondError(w, http.StatusBadRequest, "email and password are required", start)
		return
	}

	invalid := func() {
		apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, "Invalid email or password")
	}

	var u auth.User
	var hash string
	err = h.DB.QueryRow(`SELECT id, email, password_hash, role FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Email, &hash, &u.Role)
	if err == sql.ErrNoRows {
		auth.CheckPassword(dummyPasswordHash(), req.Password)
		invalid()
		return
	}
	if err != nil {
		h.serverError(w, "login lookup", err)
		return
	}
	if len(req.Password) > maxPasswordLen || !auth.CheckPassword(hash, req.Password) {
		invalid()
		return
	}

	token, expires, err := h.Auth.Issue(u)
	if err != nil {
		h.serverError(w, "issue token", err)
		return
	}
	h.respond(w, http.StatusOK, map[string]interface{}{
		"token":      token,
		"token_type": "Bearer",
		"expires_in": int(time.Until(expires).Seconds()),
		"expires_at": expires,
		"user":       u,
	}, start)
}

// Me handles GET /auth/me → {data: {user}}. It re-reads the account so a deleted user's
// still-unexpired token stops working here.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	claims, ok := auth.FromContext(r.Context())
	if !ok {
		apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, "Authentication required")
		return
	}
	if !isUUID(claims.ID) {
		apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, "Invalid token")
		return
	}
	var u auth.User
	err := h.DB.QueryRow(`SELECT id, email, role FROM users WHERE id = $1`, claims.ID).Scan(&u.ID, &u.Email, &u.Role)
	if err == sql.ErrNoRows {
		apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, "Account no longer exists")
		return
	}
	if err != nil {
		h.serverError(w, "me lookup", err)
		return
	}
	h.respond(w, http.StatusOK, map[string]interface{}{"user": u}, start)
}
