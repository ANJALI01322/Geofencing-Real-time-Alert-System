import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { authAPI } from "../api";
import {
  UNAUTHORIZED_EVENT, SESSION_STORAGE_KEY,
  clearSession, loadSession, saveSession, tokenExpiryMs,
} from "../auth/session";

const AuthContext = createContext(null);
const MAX_TIMEOUT = 2 ** 31 - 1; // setTimeout's largest delay

/**
 * AuthProvider owns the signed-in session.
 *
 * - token / user come from the server's /auth/login response and survive a page refresh
 * - role "admin" can change data; "viewer" is read-only (canWrite = false)
 * - the session ends by itself when the token expires, when the API answers 401, or when you
 *   sign out in another tab
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password);
    const d = res.data?.data;
    const next = { token: d.token, user: d.user };
    saveSession(next);
    setSession(next);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // The API said 401: the interceptor already cleared storage.
  useEffect(() => {
    const onUnauthorized = () => {
      setSession(null);
      toast("Your session has ended. Please sign in again.", { id: "session-ended", icon: "🔒" });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Another tab signed in/out.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SESSION_STORAGE_KEY || e.key === null) setSession(loadSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Sign out when the token expires.
  const token = session?.token;
  useEffect(() => {
    if (!token) return undefined;
    const exp = tokenExpiryMs(token);
    const ms = exp === null ? 0 : exp - Date.now();
    const end = () => {
      clearSession();
      setSession(null);
      toast("Your session expired. Please sign in again.", { id: "session-ended", icon: "🔒" });
    };
    if (ms <= 0) { end(); return undefined; }
    const t = setTimeout(end, Math.min(ms, MAX_TIMEOUT));
    return () => clearTimeout(t);
  }, [token]);

  // Refresh the user (role may have changed) once per token.
  useEffect(() => {
    if (!token) return;
    authAPI.me().then((r) => {
      const u = r.data?.data?.user;
      if (!u) return;
      setSession((cur) => {
        if (!cur || (cur.user?.role === u.role && cur.user?.email === u.email)) return cur;
        const next = { ...cur, user: u };
        saveSession(next);
        return next;
      });
    }).catch(() => { /* a 401 is handled by the interceptor */ });
  }, [token]);

  const value = useMemo(() => {
    const role = session?.user?.role ?? null;
    return {
      token: token ?? null,
      user: session?.user ?? null,
      role,
      isAuthenticated: !!token,
      isAdmin: role === "admin",
      isViewer: role === "viewer",
      /** true when the user may create / change data */
      canWrite: role === "admin",
      login,
      logout,
    };
  }, [session, token, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read the auth state. Must be used inside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
