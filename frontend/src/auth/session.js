// Session storage for the JWT. localStorage is used so a refresh keeps you signed in; if it is
// unavailable (private mode, blocked storage) the session lives in memory for this tab only.
//
// Trade-off: a token in localStorage can be read by any script running on the page, so the app
// must stay free of XSS (React escapes output; there is no dangerouslySetInnerHTML). Tokens
// expire after one hour.

const KEY = "geotrack-auth";
export const UNAUTHORIZED_EVENT = "geotrack:unauthorized";

let memory = null;

/** Decode the `exp` claim (ms since epoch) of a JWT without verifying it. null if unreadable. */
export function tokenExpiryMs(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(payload).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(token, skewMs = 0) {
  const exp = tokenExpiryMs(token);
  return exp === null || exp - skewMs <= Date.now();
}

/** Returns {token, user} for a stored, unexpired session — otherwise null (and clears it). */
export function loadSession() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  let session = null;
  if (raw) {
    try { session = JSON.parse(raw); } catch { session = null; }
  } else {
    session = memory;
  }
  if (!session?.token || isExpired(session.token)) {
    clearSession();
    return null;
  }
  return session;
}

export function saveSession(session) {
  memory = session;
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* keep in memory */ }
}

export function clearSession() {
  memory = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function getToken() {
  return loadSession()?.token ?? null;
}

export const SESSION_STORAGE_KEY = KEY;
