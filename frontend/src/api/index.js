import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Response interceptor: unwrap the { data, time_ns } envelope
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
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
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get("/health"),
};

export default api;
