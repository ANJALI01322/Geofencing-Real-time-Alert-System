import { useEffect, useState } from "react";
import { violationAPI, vehicleAPI, geofenceAPI } from "../api";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle, Filter } from "lucide-react";

export default function Violations() {
  const [violations, setViolations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [filters, setFilters] = useState({ vehicle_id: "", geofence_id: "", event_type: "", limit: 20 });
  const [page, setPage] = useState(0);

  useEffect(() => {
    vehicleAPI.list().then(r => { const d = r.data?.data ?? r.data; setVehicles(Array.isArray(d) ? d : []); });
    geofenceAPI.list().then(r => { const d = r.data?.data ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
  }, []);

  useEffect(() => {
    const params = { limit: filters.limit, offset: page * filters.limit };
    if (filters.vehicle_id) params.vehicle_id = filters.vehicle_id;
    if (filters.geofence_id) params.geofence_id = filters.geofence_id;
    if (filters.event_type) params.event_type = filters.event_type;
    violationAPI.history(params).then(r => { const d = r.data?.data ?? r.data; setViolations(Array.isArray(d) ? d : []); });
  }, [filters, page]);

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #f43f5e, #e11d48)" }} />
          <h1 className="page-title">Violation History</h1>
        </div>
        <p className="page-subtitle">Complete geofence entry/exit event log</p>
      </div>

      {/* Filters */}
      <div className="glass-sm" style={{ padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={15} color="#6366f1" />
        <select className="form-input" style={{ width: "auto" }} value={filters.vehicle_id} onChange={e => { setFilters(f => ({ ...f, vehicle_id: e.target.value })); setPage(0); }}>
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
        </select>
        <select className="form-input" style={{ width: "auto" }} value={filters.geofence_id} onChange={e => { setFilters(f => ({ ...f, geofence_id: e.target.value })); setPage(0); }}>
          <option value="">All Geofences</option>
          {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-input" style={{ width: "auto" }} value={filters.event_type} onChange={e => { setFilters(f => ({ ...f, event_type: e.target.value })); setPage(0); }}>
          <option value="">All Events</option>
          <option value="entry">Entry</option>
          <option value="exit">Exit</option>
        </select>
        <select className="form-input" style={{ width: "auto" }} value={filters.limit} onChange={e => { setFilters(f => ({ ...f, limit: parseInt(e.target.value) })); setPage(0); }}>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} color="#f43f5e" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8" }}>{violations.length} events</span>
        </div>
        {violations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ color: "#334155", fontWeight: 600 }}>No violations found</div>
            <div style={{ color: "#1e293b", fontSize: "0.8rem", marginTop: 4 }}>Try different filters or create some geofence events</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Vehicle</th>
                <th>Geofence</th>
                <th>Coordinates</th>
                <th>Speed</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {violations.map(v => (
                <tr key={v.id}>
                  <td>
                    <span className={`badge ${v.event_type === "entry" ? "badge-green" : "badge-red"}`}>
                      {v.event_type === "entry" ? "▲ ENTRY" : "▼ EXIT"}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: "#e2e8f0" }}>{v.vehicle_number}</td>
                  <td>
                    <div>{v.geofence_name}</div>
                    <span className="badge badge-indigo" style={{ marginTop: 3 }}>{v.geofence_category}</span>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#64748b" }}>
                    {v.latitude?.toFixed(5)}, {v.longitude?.toFixed(5)}
                  </td>
                  <td>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      {v.speed ? `${v.speed} km/h` : "—"}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem", color: "#e2e8f0" }}>
                      {v.triggered_at ? formatDistanceToNow(new Date(v.triggered_at), { addSuffix: true }) : "—"}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#334155", marginTop: 2 }}>
                      {v.triggered_at ? format(new Date(v.triggered_at), "dd MMM, HH:mm") : ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: "0.75rem", color: "#475569" }}>
            Page {page + 1} · showing {violations.length} records
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" style={{ padding: "7px 12px" }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft size={15} />
            </button>
            <button className="btn-ghost" style={{ padding: "7px 12px" }} onClick={() => setPage(p => p + 1)} disabled={violations.length < filters.limit}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
