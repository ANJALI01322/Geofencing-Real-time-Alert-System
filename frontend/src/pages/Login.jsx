import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Satellite, Eye, EyeOff, ArrowRight, Radio, Hexagon, AlertOctagon, Sun, Moon, Lock, Mail, AlertCircle, Loader2, UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage, healthAPI } from "../api";
import { useTheme } from "../theme";

// Optional read-only demo account shown as a one-click button (set at build time; see README).
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;
const HAS_DEMO = !!(DEMO_EMAIL && DEMO_PASSWORD);

const FEATURES = [
  { icon: Radio,        title: "Live fleet tracking",   text: "Every vehicle on the map, updated in real time." },
  { icon: Hexagon,      title: "Geofence alerts",       text: "Instant entry, exit and speed-limit notifications." },
  { icon: AlertOctagon, title: "Violation analytics",   text: "A searchable, exportable log of every event." },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef(null);

  // Render's free tier sleeps when idle: poke it now so it is awake by the time you press Sign in.
  useEffect(() => { healthAPI.check().catch(() => {}); }, []);
  useEffect(() => { emailRef.current?.focus(); }, []);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (e, creds) => {
    e?.preventDefault();
    const em = (creds?.email ?? email).trim();
    const pw = creds?.password ?? password;
    if (!em || !pw) { setError("Enter your email and password."); return; }
    setBusy(true);
    setError("");
    try {
      await login(em, pw);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Can't reach the server. Please try again in a moment."));
      setBusy(false);
    }
  };

  return (
    <div className="gt-login">
      <aside className="gt-login-hero" aria-hidden="true">
        <div className="gt-login-brand">
          <div className="gt-sb-logo"><Satellite size={16} color="#fff" /></div>
          <span>GeoTrack</span>
        </div>
        <div className="gt-login-pitch">
          <h2>Know where your fleet is, and the moment it leaves the line.</h2>
          <ul>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="gt-login-ico"><Icon size={16} /></span>
                <div><b>{title}</b><p>{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <small>Real-time geofencing &amp; fleet alerts</small>
      </aside>

      <main className="gt-login-main">
        <button type="button" className="gt-login-theme" onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <form className="gt-login-card" onSubmit={submit} noValidate>
          <div className="gt-login-mark">
            <div className="gt-sb-logo"><Satellite size={16} color="#fff" /></div>
            <span>GeoTrack</span>
          </div>
          <h1>Welcome back</h1>
          <p className="gt-login-sub">Sign in to manage your fleet.</p>

          {error && (
            <div className="gt-login-error" role="alert">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}

          <label className="form-label" htmlFor="email">Email</label>
          <div className="gt-login-field">
            <Mail size={16} />
            <input id="email" ref={emailRef} className="form-input" type="email" inputMode="email"
              autoComplete="username" placeholder="you@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          </div>

          <label className="form-label" htmlFor="password">Password</label>
          <div className="gt-login-field">
            <Lock size={16} />
            <input id="password" className="form-input" type={show ? "text" : "password"}
              autoComplete="current-password" placeholder="Your password" value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            <button type="button" className="gt-login-eye" onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" className="btn btn-primary gt-login-submit" disabled={busy}>
            {busy ? <><Loader2 size={16} className="gt-spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
          </button>

          {HAS_DEMO && (
            <>
              <div className="gt-login-or"><span>or</span></div>
              <button type="button" className="btn btn-secondary gt-login-demo" disabled={busy}
                onClick={() => submit(null, { email: DEMO_EMAIL, password: DEMO_PASSWORD })}>
                <UserRound size={16} /> Continue as demo viewer
              </button>
              <p className="gt-login-note">The demo account is read-only: you can explore everything but not change data.</p>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
