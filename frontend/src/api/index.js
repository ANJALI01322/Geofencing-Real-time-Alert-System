import axios from "axios";
import toast from "react-hot-toast";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // Render's free tier can take ~30s to wake from sleep
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
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get("/health"),
};

export default api;
