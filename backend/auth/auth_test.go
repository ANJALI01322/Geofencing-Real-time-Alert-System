package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"geotrack/apierr"
)

const testSecret = "0123456789abcdef0123456789abcdef-test-secret"

func newTestService(t *testing.T) *Service {
	t.Helper()
	s, err := NewService([]byte(testSecret), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func tokenFor(t *testing.T, s *Service, role string) string {
	t.Helper()
	tok, _, err := s.Issue(User{ID: "11111111-1111-1111-1111-111111111111", Email: "a@example.com", Role: role})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

// do runs a request through the middleware wrapped around a handler that answers 200.
func do(s *Service, method, path, token string, viaQuery bool) *httptest.ResponseRecorder {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	target := path
	if viaQuery && token != "" {
		target += "?token=" + token
	}
	req := httptest.NewRequest(method, target, nil)
	if !viaQuery && token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	s.Middleware(next).ServeHTTP(rec, req)
	return rec
}

func errorOf(t *testing.T, rec *httptest.ResponseRecorder) apierr.Detail {
	t.Helper()
	var b apierr.Body
	if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, rec.Body.String())
	}
	return b.Error
}

func TestMiddleware_PublicPathsNeedNoToken(t *testing.T) {
	s := newTestService(t)
	for _, p := range []string{"/health", "/auth/login"} {
		if rec := do(s, "GET", p, "", false); rec.Code != http.StatusOK {
			t.Errorf("%s: want 200, got %d", p, rec.Code)
		}
	}
}

func TestMiddleware_ProtectedPathWithoutToken(t *testing.T) {
	s := newTestService(t)
	for _, p := range []string{"/vehicles", "/geofences", "/violations/history", "/auth/me", "/anything/else"} {
		rec := do(s, "GET", p, "", false)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: want 401, got %d", p, rec.Code)
		}
		if e := errorOf(t, rec); e.Code != apierr.CodeUnauthorized {
			t.Errorf("%s: want code UNAUTHORIZED, got %q", p, e.Code)
		}
	}
}

func TestMiddleware_ValidToken(t *testing.T) {
	s := newTestService(t)
	if rec := do(s, "GET", "/vehicles", tokenFor(t, s, RoleAdmin), false); rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMiddleware_ExpiredToken(t *testing.T) {
	s := newTestService(t)
	s.now = func() time.Time { return time.Now().Add(-2 * time.Hour) } // issued two hours ago, 1h ttl
	tok := tokenFor(t, s, RoleAdmin)
	s.now = time.Now

	rec := do(s, "GET", "/vehicles", tok, false)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rec.Code)
	}
	if e := errorOf(t, rec); !strings.Contains(e.Message, "expired") {
		t.Errorf("message should say the token expired, got %q", e.Message)
	}
}

func TestMiddleware_WrongSecret(t *testing.T) {
	other, _ := NewService([]byte("a-completely-different-secret-of-32-bytes!!"), time.Hour)
	tok := tokenFor(t, other, RoleAdmin)
	if rec := do(newTestService(t), "GET", "/vehicles", tok, false); rec.Code != http.StatusUnauthorized {
		t.Fatalf("token signed with another secret: want 401, got %d", rec.Code)
	}
}

func TestMiddleware_RejectsAlgNoneAndOtherAlgorithms(t *testing.T) {
	s := newTestService(t)
	claims := Claims{Email: "a@example.com", Role: RoleAdmin, RegisteredClaims: jwt.RegisteredClaims{
		Subject: "x", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}}

	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, claims).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if rec := do(s, "GET", "/vehicles", none, false); rec.Code != http.StatusUnauthorized {
		t.Errorf("alg=none: want 401, got %d", rec.Code)
	}

	hs512, _ := jwt.NewWithClaims(jwt.SigningMethodHS512, claims).SignedString([]byte(testSecret))
	if rec := do(s, "GET", "/vehicles", hs512, false); rec.Code != http.StatusUnauthorized {
		t.Errorf("alg=HS512: want 401 (only HS256 allowed), got %d", rec.Code)
	}
}

func TestMiddleware_RejectsTokenWithoutExpiry(t *testing.T) {
	s := newTestService(t)
	claims := Claims{Email: "a@example.com", Role: RoleAdmin, RegisteredClaims: jwt.RegisteredClaims{Subject: "x"}}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if rec := do(s, "GET", "/vehicles", tok, false); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no exp claim: want 401, got %d", rec.Code)
	}
}

func TestMiddleware_MalformedAuthorizationHeader(t *testing.T) {
	s := newTestService(t)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	for _, h := range []string{"", "Bearer", "Bearer ", "Basic abc", "token abc", "Bearer not.a.jwt"} {
		req := httptest.NewRequest("GET", "/vehicles", nil)
		if h != "" {
			req.Header.Set("Authorization", h)
		}
		rec := httptest.NewRecorder()
		s.Middleware(next).ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Authorization %q: want 401, got %d", h, rec.Code)
		}
	}
}

func TestMiddleware_RoleChecks(t *testing.T) {
	s := newTestService(t)
	admin, viewer := tokenFor(t, s, RoleAdmin), tokenFor(t, s, RoleViewer)

	cases := []struct {
		name, method, token string
		want                int
	}{
		{"viewer GET", "GET", viewer, 200},
		{"viewer HEAD", "HEAD", viewer, 200},
		{"viewer POST", "POST", viewer, 403},
		{"viewer PUT", "PUT", viewer, 403},
		{"viewer DELETE", "DELETE", viewer, 403},
		{"admin GET", "GET", admin, 200},
		{"admin POST", "POST", admin, 200},
		{"admin PUT", "PUT", admin, 200},
		{"admin DELETE", "DELETE", admin, 200},
	}
	for _, c := range cases {
		rec := do(s, c.method, "/vehicles", c.token, false)
		if rec.Code != c.want {
			t.Errorf("%s: want %d, got %d", c.name, c.want, rec.Code)
		}
		if c.want == 403 {
			if e := errorOf(t, rec); e.Code != apierr.CodeForbidden {
				t.Errorf("%s: want code FORBIDDEN, got %q", c.name, e.Code)
			}
		}
	}
}

func TestMiddleware_UnknownRoleIsForbidden(t *testing.T) {
	s := newTestService(t)
	if rec := do(s, "GET", "/vehicles", tokenFor(t, s, "superuser"), false); rec.Code != http.StatusForbidden {
		t.Fatalf("unknown role: want 403, got %d", rec.Code)
	}
}

func TestMiddleware_WebSocketTokenViaQuery(t *testing.T) {
	s := newTestService(t)
	tok := tokenFor(t, s, RoleViewer)

	if rec := do(s, "GET", "/ws/alerts", tok, true); rec.Code != http.StatusOK {
		t.Errorf("valid ?token=: want 200, got %d", rec.Code)
	}
	if rec := do(s, "GET", "/ws/alerts", "garbage", true); rec.Code != http.StatusUnauthorized {
		t.Errorf("invalid ?token=: want 401, got %d", rec.Code)
	}
	if rec := do(s, "GET", "/ws/alerts", "", true); rec.Code != http.StatusUnauthorized {
		t.Errorf("missing token: want 401, got %d", rec.Code)
	}
	// The query-string token is accepted for the WebSocket only, never for ordinary routes.
	if rec := do(s, "GET", "/vehicles", tok, true); rec.Code != http.StatusUnauthorized {
		t.Errorf("?token= on /vehicles: want 401, got %d", rec.Code)
	}
}

func TestMiddleware_PutsUserInContext(t *testing.T) {
	s := newTestService(t)
	var got User
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, _ = FromContext(r.Context())
	})
	req := httptest.NewRequest("GET", "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tokenFor(t, s, RoleViewer))
	s.Middleware(next).ServeHTTP(httptest.NewRecorder(), req)
	if got.Email != "a@example.com" || got.Role != RoleViewer || got.ID == "" {
		t.Fatalf("user not in context: %+v", got)
	}
}

func TestIssue_ExpiresInOneHour(t *testing.T) {
	s := newTestService(t)
	tok, exp, err := s.Issue(User{ID: "x", Email: "a@example.com", Role: RoleAdmin})
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Until(exp); d < 59*time.Minute || d > time.Hour {
		t.Errorf("expiry should be ~1h away, got %v", d)
	}
	c, err := s.Parse(tok)
	if err != nil || c.Role != RoleAdmin || c.Email != "a@example.com" {
		t.Errorf("round trip failed: %+v %v", c, err)
	}
}

func TestNewService_RejectsShortSecret(t *testing.T) {
	if _, err := NewService([]byte("short"), time.Hour); err == nil {
		t.Fatal("a short secret must be rejected")
	}
}

func TestSecretFromEnv(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	s, eph, err := SecretFromEnv()
	if err != nil || eph || string(s) != testSecret {
		t.Fatalf("configured secret: got %q eph=%v err=%v", s, eph, err)
	}

	t.Setenv("JWT_SECRET", "too-short")
	if _, _, err := SecretFromEnv(); err == nil {
		t.Fatal("JWT_SECRET shorter than 32 chars must be an error")
	}

	t.Setenv("JWT_SECRET", "")
	a, eph, err := SecretFromEnv()
	if err != nil || !eph || len(a) < MinSecretLen {
		t.Fatalf("unset: want an ephemeral strong secret, got len=%d eph=%v err=%v", len(a), eph, err)
	}
	b, _, _ := SecretFromEnv()
	if string(a) == string(b) {
		t.Fatal("ephemeral secrets must be random per call")
	}
}

func TestPasswordHashing(t *testing.T) {
	old := BcryptCost
	BcryptCost = bcrypt.MinCost
	defer func() { BcryptCost = old }()

	h, err := HashPassword("correct horse battery")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(h, "correct horse") {
		t.Fatal("hash must not contain the password")
	}
	if !CheckPassword(h, "correct horse battery") {
		t.Error("right password rejected")
	}
	if CheckPassword(h, "wrong") || CheckPassword("not-a-hash", "x") {
		t.Error("wrong password / bad hash accepted")
	}
	h2, _ := HashPassword("correct horse battery")
	if h == h2 {
		t.Error("hashes must be salted (two hashes of one password differ)")
	}
}

func TestNormalizeEmail(t *testing.T) {
	ok := map[string]string{"  Admin@Example.COM ": "admin@example.com", "a@b.co": "a@b.co"}
	for in, want := range ok {
		if got, err := NormalizeEmail(in); err != nil || got != want {
			t.Errorf("NormalizeEmail(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "nope", "a@", "@b.com", "Name <a@b.com>", "a b@c.com"} {
		if _, err := NormalizeEmail(bad); err == nil {
			t.Errorf("NormalizeEmail(%q) should fail", bad)
		}
	}
}
