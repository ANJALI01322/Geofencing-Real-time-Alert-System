import axios from "axios";
import toast from "react-hot-toast";
import { clearSession, getToken, UNAUTHORIZED_EVENT } from "../auth/session";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // Render's free tier can take ~30s to wake from sleep
});

/**
 * The human-readable message of an API error: {"error":{"code","message"}} from the server,
 * or `fallback` when the request never got a response.
 */
export function apiErrorMessage(err, fallback = "Something went wrong") {
  const e = err?.response?.data?.error;
  if (e && typeof e === "object" && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return fallback;
}

// ── Auth: send the JWT on every request ──
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Resilience: retry idempotent GETs and tell the user what is happening ──
const STATUS_TOAST_ID = "api-status";
const MAX_RETRIES = 2;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let degraded = false;

api.interceptors.response.use(
  (res) => {
    if (degraded) {
      degraded = false;
      toast.dismiss(STATUS_TOAST_ID);
    }
    return res;
  },
  async (err) => {
    const config = err.config;
    const status = err.response?.status;

    // Expired / invalid token: drop the session and let the app send the user to /login.
    // (A failed sign-in attempt is also a 401 but is handled by the login form itself.)
    if (status === 401 && !config?.url?.includes("/auth/login")) {
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      return Promise.reject(err);
    }

    const noResponse = !err.response && err.code !== "ERR_CANCELED"; // network error / timeout / CORS
    const serverError = status >= 500;
    if (!config || !(noResponse || serverError)) return Promise.reject(err);

    degraded = true;
    config.__retries = config.__retries || 0;
    const canRetry = config.method === "get" && config.__retries < MAX_RETRIES;

    if (noResponse) {
      toast.loading("Waking up server… this can take up to 30 seconds", { id: STATUS_TOAST_ID });
    } else {
      toast.error("Server unreachable, retrying…", { id: STATUS_TOAST_ID });
    }

    if (canRetry) {
      config.__retries += 1;
      await wait(2000 * config.__retries);
      return api(config);
    }

    toast.error("Server unreachable. Please try again in a moment.", { id: STATUS_TOAST_ID, duration: 5000 });
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  me:    ()                => api.get("/auth/me"),
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
export const vehicleAPI = {
  create: (data) => api.post("/vehicles", data),
  list:   ()     => api.get("/vehicles"),
};

// ── Geofences ─────────────────────────────────────────────────────────────────
export const geofenceAPI = {
  create: (data)      => api.post("/geofences", data),
  list:   (category)  => api.get("/geofences", { params: category ? { category } : {} }),
};

// ── Locations ─────────────────────────────────────────────────────────────────
export const locationAPI = {
  update: (data)       => api.post("/vehicles/location", data),
  get:    (vehicleId)  => api.get(`/vehicles/location/${vehicleId}`),
};

// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertAPI = {
  configure: (data)       => api.post("/alerts/configure", data),
  list:      (params)     => api.get("/alerts", { params }),
};

// ── Violations ────────────────────────────────────────────────────────────────
export const violationAPI = {
  history: (params) => api.get("/violations/history", { params }),
  stats:   ()       => api.get("/violations/stats"),
  // Per-zone and per-vehicle counts over ALL rows (history itself is paginated, max 100/page)
  summary: ()       => api.get("/violations/summary"),
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get("/health"),
};

export default api;
