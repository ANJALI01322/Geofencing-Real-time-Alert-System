import { useEffect, useState } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import { AlertOctagon, ArrowUp, ArrowDown, Filter, RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Violations() {
  const [violations, setViolations] = useState([]);
  const [vehicles,   setVehicles]   = useState([]);
  const [geofences,  setGeofences]  = useState([]);
  const [filters, setFilters] = useState({ vehicle_id: "", geofence_id: "", event_type: "", limit: 50 });
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.vehicle_id)  params.vehicle_id  = filters.vehicle_id;
    if (filters.geofence_id) params.geofence_id = filters.geofence_id;
    if (filters.event_type)  params.event_type  = filters.event_type;
    params.limit = filters.limit;
    violationAPI.history(params)
      .then(r => { const d = r.data?.data ?? r.data; setViolations(Array.isArray(d) ? d : []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    vehicleAPI.list().then(r  => { const d = r.data?.data ?? r.data; setVehicles(Array.isArray(d) ? d : []); });
    geofenceAPI.list().then(r => { const d = r.data?.data ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
    load();
  }, []);

  const totalEntry = violations.filter(v => v.event_type === "entry").length;
  const totalExit  = violations.filter(v => v.event_type === "exit").length;

  return (
    <div className="page-wrap content-scroll">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 24, background: "var(--red)", borderRadius: 2, boxShadow: "0 0 8px var(--red)" }} />
            <h1 className="page-heading">Violation Log</h1>
          </div>
          <p className="page-sub">{violations.length} records · {totalEntry} entries, {totalExit} exits</p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <div className="panel" style={{ padding: "14px 18px" }}>
          <div className="stat-label">Total Events</div>
          <div style={{ fontSize: "1.8rem", fontFamily: "Space Grotesk", fontWeight: 700, color: "var(--text-1)" }}>{violations.length}</div>
        </div>
        <div className="panel" style={{ padding: "14px 18px", borderTop: "2px solid var(--green)" }}>
          <div className="stat-label">Zone Entries</div>
          <div style={{ fontSize: "1.8rem", fontFamily: "Space Grotesk", fontWeight: 700, color: "var(--green)" }}>{totalEntry}</div>
        </div>
        <div className="panel" style={{ padding: "14px 18px", borderTop: "2px solid var(--red)" }}>
          <div className="stat-label">Zone Exits</div>
          <div style={{ fontSize: "1.8rem", fontFamily: "Space Grotesk", fontWeight: 700, color: "var(--red)" }}>{totalExit}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={13} color="var(--blue)" />
            <span className="panel-title">Filters</span>
          </div>
        </div>
        <div style={{ padding: "14px 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="form-input" style={{ maxWidth: 180 }}
            value={filters.vehicle_id} onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
          </select>
          <select className="form-input" style={{ maxWidth: 180 }}
            value={filters.geofence_id} onChange={e => setFilters(f => ({ ...f, geofence_id: e.target.value }))}>
            <option value="">All Zones</option>
            {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-input" style={{ maxWidth: 140 }}
            value={filters.event_type} onChange={e => setFilters(f => ({ ...f, event_type: e.target.value }))}>
            <option value="">All Events</option>
            <option value="entry">Entry</option>
            <option value="exit">Exit</option>
          </select>
          <select className="form-input" style={{ maxWidth: 110 }}
            value={filters.limit} onChange={e => setFilters(f => ({ ...f, limit: e.target.value }))}>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <button className="btn-primary" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertOctagon size={14} color="var(--red)" />
            <span className="panel-title">Events</span>
          </div>
          <span className="badge badge-red">{violations.length}</span>
        </div>
        {loading ? (
          <div>{[1,2,3,4,5].map(i => <div key={i} className="shimmer" style={{ height: 48, margin: "1px 0" }} />)}</div>
        ) : violations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <AlertOctagon size={32} color="var(--text-3)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>No violations found</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", opacity: 0.6, marginTop: 4 }}>Try different filters</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Vehicle</th>
                <th>Zone</th>
                <th>Coordinates</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={v.id || i}>
                  <td>
                    <span className={`badge ${v.event_type === "entry" ? "badge-green" : "badge-red"}`}>
                      {v.event_type === "entry" ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                      {v.event_type?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "var(--text-1)", fontFamily: "Space Grotesk" }}>
                      {v.vehicle_number || "—"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>{v.geofence_name || "—"}</td>
                  <td className="mono" style={{ fontSize: "0.73rem", color: "var(--text-3)" }}>
                    {v.latitude?.toFixed(5)}, {v.longitude?.toFixed(5)}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={11} color="var(--text-3)" />
                      <span className="mono" style={{ fontSize: "0.73rem", color: "var(--text-3)" }}>
                        {v.triggered_at ? format(new Date(v.triggered_at), "dd MMM, HH:mm:ss") : "—"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
