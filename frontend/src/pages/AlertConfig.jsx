import { useEffect, useState } from "react";
import { vehicleAPI, geofenceAPI, alertAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, X, SlidersHorizontal, Trash2, Bell, ChevronRight, Zap } from "lucide-react";

const EVENT_OPTIONS = [
  { value: "entry", label: "Zone Entry" },
  { value: "exit",  label: "Zone Exit" },
  { value: "both",  label: "Entry & Exit" },
];

export default function AlertConfig() {
  const [vehicles,  setVehicles]  = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [rules,     setRules]     = useState([]);
  const [form, setForm] = useState({ vehicle_id: "", geofence_id: "", event_type: "both", speed_limit: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    vehicleAPI.list().then(r => { const d = r.data?.data?.vehicles ?? r.data?.vehicles ?? r.data; setVehicles(Array.isArray(d) ? d : []); });
    geofenceAPI.list().then(r => { const d = r.data?.data?.geofences ?? r.data?.geofences ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
    alertAPI.list().then(r => { const d = r.data?.data?.rules ?? r.data?.rules ?? r.data?.data ?? r.data; setRules(Array.isArray(d) ? d : []); });
  }, []);

  const save = async e => {
    e.preventDefault();
    if (!form.vehicle_id || !form.geofence_id) return toast.error("Select vehicle and zone");
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.speed_limit) payload.speed_limit = parseFloat(form.speed_limit);
      else delete payload.speed_limit;
      await alertAPI.configure(payload);
      toast.success("Alert rule saved");
      setForm({ vehicle_id: "", geofence_id: "", event_type: "both", speed_limit: "" });
      setShowForm(false);
      alertAPI.list().then(r => { const d = r.data?.data ?? r.data; setRules(Array.isArray(d) ? d : []); });
    } catch { toast.error("Failed to save rule"); }
    finally { setLoading(false); }
  };

  const getLabel = (arr, id, field = "name") => arr.find(x => x.id === id)?.[field] || id?.slice(0,8) || "—";

  return (
    <div className="page-wrap content-scroll">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 24, background: "var(--amber)", borderRadius: 2, boxShadow: "0 0 8px var(--amber)" }} />
            <h1 className="page-heading">Alert Rules</h1>
          </div>
          <p className="page-sub">{rules.length} rule{rules.length !== 1 ? "s" : ""} configured · geofence trigger policies</p>
        </div>
        <button className="btn-ghost" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "New Rule"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={13} color="var(--amber)" />
              <span className="panel-title">Configure Alert Rule</span>
            </div>
          </div>
          <form onSubmit={save} style={{ padding: "18px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="form-label">Vehicle *</label>
                <select className="form-input" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} — {v.driver_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Geofence Zone *</label>
                <select className="form-input" value={form.geofence_id} onChange={e => setForm(f => ({ ...f, geofence_id: e.target.value }))} required>
                  <option value="">Select zone…</option>
                  {geofences.map(g => <option key={g.geofence_id} value={g.geofence_id}>{g.geofence_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Trigger Event</label>
                <select className="form-input" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  {EVENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Speed Limit (km/h)</label>
                <input className="form-input" type="number" placeholder="Optional"
                  value={form.speed_limit} onChange={e => setForm(f => ({ ...f, speed_limit: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving…" : <>Save Rule <ChevronRight size={13} /></>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={14} color="var(--amber)" />
            <span className="panel-title">Active Rules</span>
          </div>
          <span className="badge badge-amber">{rules.length}</span>
        </div>
        {rules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Bell size={32} color="var(--text-3)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>No alert rules configured</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", opacity: 0.6, marginTop: 4 }}>Create a rule to monitor vehicle–zone interactions</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Zone</th>
                <th>Trigger</th>
                <th>Speed Limit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id || i}>
                  <td>
                    <span style={{ fontWeight: 600, color: "var(--text-1)", fontFamily: "Space Grotesk" }}>
                      {vehicles.find(v=>v.vehicle_id===r.vehicle_id)?.vehicle_number || r.vehicle_id?.slice(0,8) || '—'}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>{geofences.find(g=>g.geofence_id===r.geofence_id)?.geofence_name || r.geofence_id?.slice(0,8) || '—'}</td>
                  <td>
                    <span className={`badge ${
                      r.event_type === "entry" ? "badge-green" :
                      r.event_type === "exit"  ? "badge-red"   : "badge-blue"
                    }`}>
                      {r.event_type?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {r.speed_limit ? (
                      <span className="mono text-amber" style={{ fontSize: "0.78rem" }}>{r.speed_limit} km/h</span>
                    ) : (
                      <span className="text-muted mono" style={{ fontSize: "0.78rem" }}>—</span>
                    )}
                  </td>
                  <td><span className="badge badge-green">ACTIVE</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
