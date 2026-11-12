import { useEffect, useState } from "react";
import { vehicleAPI, geofenceAPI, alertAPI as alertConfigAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, Bell, Settings, ChevronRight, X } from "lucide-react";

const EVENT_BADGE = { entry: "badge-green", exit: "badge-red", both: "badge-purple" };

export default function AlertConfig() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ vehicle_id: "", geofence_id: "", event_type: "both" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => {
    vehicleAPI.list().then(r => { const d = r.data?.data ?? r.data; setVehicles(Array.isArray(d) ? d : []); });
    geofenceAPI.list().then(r => { const d = r.data?.data ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
    alertConfigAPI.list().then(r => { const d = r.data?.data ?? r.data; setRules(Array.isArray(d) ? d : []); });
  };
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { geofence_id: form.geofence_id, event_type: form.event_type };
      if (form.vehicle_id) payload.vehicle_id = form.vehicle_id;
      await alertConfigAPI.create(payload);
      toast.success("Alert rule configured!");
      setForm({ vehicle_id: "", geofence_id: "", event_type: "both" });
      setShowForm(false);
      load();
    } catch { toast.error("Failed to create rule"); }
    finally { setLoading(false); }
  };

  const getGeofenceName = id => geofences.find(g => g.id === id)?.name || id;
  const getVehicleName = id => vehicles.find(v => v.id === id)?.vehicle_number || "All Vehicles";

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #f59e0b, #d97706)" }} />
            <h1 className="page-title">Alert Configuration</h1>
          </div>
          <p className="page-subtitle">Define geofence entry/exit rules per vehicle or fleet-wide</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "New Rule"}
        </button>
      </div>

      {showForm && (
        <div className="glass card-glow-indigo" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e2e8f0" }}>Create Alert Rule</div>
              <div style={{ fontSize: "0.75rem", color: "#475569" }}>Configure when to fire an alert</div>
            </div>
          </div>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Geofence *</label>
              <select className="form-input" required value={form.geofence_id} onChange={e => setForm(f => ({ ...f, geofence_id: e.target.value }))}>
                <option value="">Select zone...</option>
                {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Vehicle (optional)</label>
              <select className="form-input" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Event Type</label>
              <select className="form-input" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                <option value="entry">Entry Only</option>
                <option value="exit">Exit Only</option>
                <option value="both">Entry &amp; Exit</option>
              </select>
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : "Save Rule"} <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={16} color="#f59e0b" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8" }}>Active Rules — {rules.length} configured</span>
        </div>
        {rules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <div style={{ color: "#334155", fontWeight: 600 }}>No alert rules yet</div>
            <div style={{ color: "#1e293b", fontSize: "0.8rem", marginTop: 4 }}>Create a rule to start receiving geofence alerts</div>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Geofence</th><th>Vehicle</th><th>Event Type</th><th>Created</th></tr></thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ color: "#334155", fontFamily: "monospace" }}>{i + 1}</td>
                  <td><span style={{ fontWeight: 600, color: "#e2e8f0" }}>{getGeofenceName(r.geofence_id)}</span></td>
                  <td><span className="badge badge-cyan">{getVehicleName(r.vehicle_id)}</span></td>
                  <td><span className={`badge ${EVENT_BADGE[r.event_type]}`}>{r.event_type}</span></td>
                  <td style={{ color: "#475569", fontSize: "0.8rem" }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
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
