import { useEffect, useState, useCallback } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import {
  AlertOctagon, ArrowUpRight, ArrowDownRight, Filter,
  RefreshCw, Clock, MapPin, Car, Shield, TrendingUp, Download
} from "lucide-react";
import { format } from "date-fns";
import EmptyState from "../components/EmptyState";

export default function Violations() {
  const [violations, setViolations] = useState([]);
  const [vehicles,   setVehicles]   = useState([]);
  const [geofences,  setGeofences]  = useState([]);
  const [filters, setFilters] = useState({ vehicle_id: "", geofence_id: "", event_type: "", limit: 50 });
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [stats, setStats] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: filters.limit };
    if (filters.vehicle_id)  params.vehicle_id  = filters.vehicle_id;
    if (filters.geofence_id) params.geofence_id = filters.geofence_id;
    if (filters.event_type)  params.event_type  = filters.event_type;
    violationAPI.history(params)
      .then(r => {
        const d = r.data?.data?.violations ?? r.data?.violations ?? r.data?.data ?? r.data;
        setViolations(Array.isArray(d) ? d : []);
        setLastRefresh(new Date());
      })
      .catch(() => setViolations([]))
      .finally(() => setLoading(false));
    // Single source of truth for totals: /violations/stats
    violationAPI.stats()
      .then(r => {
        const st = r.data?.data ?? r.data;
        setStats({ entry: Number(st?.entry) || 0, exit: Number(st?.exit) || 0, speed: Number(st?.speed) || 0 });
      })
      .catch(() => setStats(null));
  }, [filters]);

  useEffect(() => {
    vehicleAPI.list().then(r => {
      const d = r.data?.data?.vehicles ?? r.data?.vehicles ?? r.data?.data ?? r.data;
      setVehicles(Array.isArray(d) ? d : []);
    }).catch(() => {});
    geofenceAPI.list().then(r => {
      const d = r.data?.data?.geofences ?? r.data?.geofences ?? r.data?.data ?? r.data;
      setGeofences(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Totals come from the stats endpoint; fall back to the loaded list only if it fails
  const lc = v => (v.event_type || "").toLowerCase();
  const src = stats || {
    entry: violations.filter(v => lc(v) === "entry").length,
    exit:  violations.filter(v => lc(v) === "exit").length,
    speed: violations.filter(v => lc(v) === "speed_violation").length,
  };
  const totalEntry = src.entry;
  const totalExit  = src.exit;
  const totalAll   = src.entry + src.exit + src.speed;
  const entryPct   = totalAll > 0 ? Math.round((totalEntry / totalAll) * 100) : 0;
  const exitPct    = totalAll > 0 ? Math.round((totalExit / totalAll) * 100) : 0;

  // Filtering is done by the "Filter Events" card (server side); CSV exports what is shown
  const filtered = violations;

  const exportCSV = () => {
    const cols = ["timestamp", "vehicle_number", "geofence_name", "event_type"];
    const esc = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...filtered.map(v => cols.map(c => esc(v[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "violations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel = {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.82rem",
    padding: "9px 12px",
    border: "1.5px solid #E5E7EB",
    borderRadius: 8,
    background: "#fff",
    color: "#374151",
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
  };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 3, background: "linear-gradient(90deg,#3B82F6,#22C55E)", margin: "-28px -32px 25px" }} />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#FEE2E2,#FCA5A5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertOctagon size={20} color="#DC2626" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: 0 }}>Violation Log</h1>
            <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: 0, marginTop: 2 }}>Geofence boundary crossing events · Auto-refresh every 5s</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: "0.73rem", color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> Last updated {format(lastRefresh, "HH:mm:ss")}
            </span>
          )}
          <button onClick={exportCSV} disabled={filtered.length === 0} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: "0.82rem", fontWeight: 500, cursor: filtered.length === 0 ? "default" : "pointer", fontFamily: "'Inter', sans-serif" }}>
            <Download size={13} />
            Export CSV
          </button>
          <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="gt-stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>TOTAL EVENTS</div>
            <div style={{ fontSize: "2.1rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#111827", lineHeight: 1 }}>{totalAll}</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 7 }}>All recorded events</div>
          </div>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={24} color="#2563EB" />
          </div>
        </div>

        <div className="gt-stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ZONE ENTRIES</div>
            <div style={{ fontSize: "2.1rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#16A34A", lineHeight: 1 }}>{totalEntry}</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 7 }}><span style={{ color: "#22C55E", fontWeight: 700 }}>{entryPct}%</span> of total events</div>
          </div>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowDownRight size={26} color="#22C55E" />
          </div>
        </div>

        <div className="gt-stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ZONE EXITS</div>
            <div style={{ fontSize: "2.1rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#DC2626", lineHeight: 1 }}>{totalExit}</div>
            <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 7 }}><span style={{ color: "#EF4444", fontWeight: 700 }}>{exitPct}%</span> of total events</div>
          </div>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "#FFF1F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowUpRight size={26} color="#EF4444" />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Filter size={13} color="#2563EB" />
          </div>
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#111827" }}>Filter Events</span>
          <span style={{ fontSize: "0.73rem", color: "#9CA3AF", marginLeft: 2 }}>Narrow results by vehicle, zone, or type</span>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Vehicle</label>
            <select style={{ ...sel, minWidth: 200 }} value={filters.vehicle_id} onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}>
              <option value="">All Vehicles</option>
              {vehicles.map(v => <option key={v.vehicle_id || v.id} value={v.vehicle_id || v.id}>{v.vehicle_number} — {v.driver_name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Zone</label>
            <select style={{ ...sel, minWidth: 180 }} value={filters.geofence_id} onChange={e => setFilters(f => ({ ...f, geofence_id: e.target.value }))}>
              <option value="">All Zones</option>
              {geofences.map(g => <option key={g.geofence_id || g.id} value={g.geofence_id || g.id}>{g.geofence_name || g.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Event Type</label>
            <select style={{ ...sel, minWidth: 130 }} value={filters.event_type} onChange={e => setFilters(f => ({ ...f, event_type: e.target.value }))}>
              <option value="">All Events</option>
              <option value="entry">↓ Entry</option>
              <option value="exit">↑ Exit</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Rows</label>
            <select style={{ ...sel, minWidth: 100 }} value={filters.limit} onChange={e => setFilters(f => ({ ...f, limit: e.target.value }))}>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
          <button onClick={load} disabled={loading} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: loading ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6, height: 38 }}>
            {loading ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Filter size={12} />}
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FFF1F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertOctagon size={13} color="#EF4444" />
            </div>
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#111827" }}>Events</span>
          </div>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: violations.length > 0 ? "#DC2626" : "#6B7280", background: violations.length > 0 ? "#FEE2E2" : "#F3F4F6", padding: "3px 10px", borderRadius: 20, border: violations.length > 0 ? "1px solid #FCA5A5" : "1px solid #E5E7EB" }}>
            {filtered.length} records
          </span>
        </div>

        {loading && violations.length === 0 ? (
          <div style={{ padding: "12px 16px 16px" }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          violations.length === 0 ? (
            <EmptyState good icon={Shield} title="No violations recorded" text="All vehicles are operating within geofence boundaries" />
          ) : (
            <EmptyState icon={Filter} title="No matching violations" text="Try clearing the filters" />
          )
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dt">
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Event", "Vehicle", "Driver", "Zone", "Category", "Coordinates", "Timestamp"].map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr key={v.event_id || v.id || i}
                    style={{ borderBottom: "1px solid #F3F4F6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, ...(v.event_type === "entry" ? { background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" } : v.event_type === "speed_violation" ? { background: "#FFF7ED", color: "#C2410C", border: "1px solid #FDBA74" } : { background: "#FFF1F2", color: "#DC2626", border: "1px solid #FECACA" }) }}>
                        {v.event_type === "entry" ? <ArrowDownRight size={11} /> : v.event_type === "speed_violation" ? null : <ArrowUpRight size={11} />}
                        {v.event_type === "speed_violation" ? "SPEED" : v.event_type?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Car size={14} color="#2563EB" />
                        </div>
                        <span style={{ fontWeight: 700, color: "#111827", fontSize: "0.82rem", fontFamily: "monospace", letterSpacing: "0.03em" }}>{v.vehicle_number || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}><span style={{ fontSize: "0.82rem", color: "#374151" }}>{v.driver_name || "—"}</span></td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Shield size={12} color="#7C3AED" />
                        <span style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 500 }}>{v.geofence_name || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {v.category ? (
                        <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 600, background: "#EDE9FE", color: "#6D28D9", border: "1px solid #DDD6FE" }}>{v.category.replace(/_/g, " ")}</span>
                      ) : <span style={{ color: "#D1D5DB", fontSize: "0.78rem" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={11} color="#9CA3AF" />
                        <span style={{ fontSize: "0.73rem", color: "#6B7280", fontFamily: "monospace" }}>
                          {typeof v.latitude === "number" ? v.latitude.toFixed(5) : "—"},&nbsp;{typeof v.longitude === "number" ? v.longitude.toFixed(5) : "—"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={11} color="#9CA3AF" />
                        <span style={{ fontSize: "0.73rem", color: "#6B7280", fontFamily: "monospace" }}>
                          {v.timestamp ? format(new Date(v.timestamp), "dd MMM, HH:mm:ss") : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {violations.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA" }}>
            <span style={{ fontSize: "0.73rem", color: "#9CA3AF" }}>Showing {filtered.length} of {filters.limit} max rows</span>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: "0.73rem", color: "#16A34A", fontWeight: 700 }}>↓ {totalEntry} entries</span>
              <span style={{ fontSize: "0.73rem", color: "#DC2626", fontWeight: 700 }}>↑ {totalExit} exits</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
