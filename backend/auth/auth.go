// Package auth implements JWT (HS256) authentication, bcrypt password hashing and the
// role-based access middleware.
package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"geotrack/apierr"
)

// Roles. A viewer may only read; an admin may also create.
const (
	RoleAdmin  = "admin"
	RoleViewer = "viewer"
)

// TokenTTL is how long an issued token stays valid.
const TokenTTL = time.Hour

// MinSecretLen is the shortest JWT_SECRET accepted (HS256 wants at least 256 bits).
const MinSecretLen = 32

// BcryptCost is the bcrypt work factor used for new password hashes.
var BcryptCost = 12

// User is the identity carried by a token.
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// Claims are the JWT claims: the standard registered ones plus email and role.
type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// User returns the identity stored in the claims.
func (c *Claims) User() User { return User{ID: c.Subject, Email: c.Email, Role: c.Role} }

// Service issues and verifies tokens.
type Service struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

// NewService creates a Service. The secret must be at least MinSecretLen bytes.
func NewService(secret []byte, ttl time.Duration) (*Service, error) {
	if len(secret) < MinSecretLen {
		return nil, fmt.Errorf("JWT secret must be at least %d bytes (got %d)", MinSecretLen, len(secret))
	}
	return &Service{secret: secret, ttl: ttl, now: time.Now}, nil
}

// SecretFromEnv reads JWT_SECRET. When it is not set, a random per-process secret is generated
// (ephemeral=true): the API stays secure, but tokens stop working whenever the process restarts,
// so production should always set JWT_SECRET. A secret that is set but too short is an error.
func SecretFromEnv() (secret []byte, ephemeral bool, err error) {
	if v := os.Getenv("JWT_SECRET"); v != "" {
		if len(v) < MinSecretLen {
			return nil, false, fmt.Errorf("JWT_SECRET must be at least %d characters (got %d)", MinSecretLen, len(v))
		}
		return []byte(v), false, nil
	}
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		return nil, false, fmt.Errorf("generate ephemeral JWT secret: %w", err)
	}
	log.Println("⚠️  JWT_SECRET is not set — using a random secret for this process. " +
		"Logins will be invalidated on every restart; set JWT_SECRET (32+ chars) in production.")
	return b, true, nil
}

// Issue signs a token for the user and returns it with its expiry time.
func (s *Service) Issue(u User) (string, time.Time, error) {
	now := s.now()
	exp := now.Add(s.ttl)
	claims := Claims{
		Email: u.Email,
		Role:  u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	return token, exp, err
}

// Parse verifies the signature (HS256 only — "none" and other algorithms are rejected) and the
// expiry, and returns the claims.
func (s *Service) Parse(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(*jwt.Token) (interface{}, error) {
		return s.secret, nil
	},
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(s.now),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid || claims.Subject == "" {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// HashPassword returns the bcrypt hash of a password.
func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	return string(h), err
}

// CheckPassword reports whether the password matches the bcrypt hash.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// ── Request authentication & authorisation ───────────────────────────────────

type ctxKey struct{}

// FromContext returns the authenticated user stored by the middleware.
func FromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(ctxKey{}).(User)
	return u, ok
}

// publicPaths need no token.
var publicPaths = map[string]bool{
	"/health":     true,
	"/auth/login": true,
}

// wsPath is the WebSocket endpoint. Browsers cannot set headers on a WebSocket, so its token
// is read from the ?token= query parameter instead of the Authorization header.
const wsPath = "/ws/alerts"

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

func isReadMethod(m string) bool { return m == http.MethodGet || m == http.MethodHead }

// Middleware protects every route except /health and /auth/login:
//   - no / invalid / expired token → 401
//   - a viewer using anything other than GET/HEAD → 403
//
// It fails closed: a route is protected unless it is listed in publicPaths.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if publicPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		token := bearerToken(r)
		if token == "" && r.URL.Path == wsPath {
			token = r.URL.Query().Get("token")
		}
		if token == "" {
			apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, "Authentication required")
			return
		}

		claims, err := s.Parse(token)
		if err != nil {
			msg := "Invalid token"
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg = "Token expired, please sign in again"
			}
			apierr.Write(w, http.StatusUnauthorized, apierr.CodeUnauthorized, msg)
			return
		}

		switch claims.Role {
		case RoleAdmin:
		case RoleViewer:
			if !isReadMethod(r.Method) {
				apierr.Write(w, http.StatusForbidden, apierr.CodeForbidden, "Read-only account: this action requires the admin role")
				return
			}
		default:
			apierr.Write(w, http.StatusForbidden, apierr.CodeForbidden, "Unknown role")
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, claims.User())))
	})
}
