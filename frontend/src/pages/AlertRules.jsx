import { useEffect, useState, useCallback } from "react";
import { vehicleAPI, geofenceAPI, alertAPI } from "../api";
import toast from "react-hot-toast";
import { Bell } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";

const card = { background: "var(--surface)", borderRadius: 14, border: "1.5px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const label = { fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" };
const input = { fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text-2)", outline: "none", minWidth: 200 };

export default function AlertRules() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ vehicle_id: "", geofence_id: "", event_type: "both" });
  const [saving, setSaving] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(false);

  const loadRules = useCallback(() => {
    setRulesError(false);
    alertAPI.list().then(r => {
      const d = r.data?.data?.alert_rules ?? r.data?.alert_rules ?? r.data?.data ?? r.data;
      setRules(Array.isArray(d) ? d : []);
    }).catch(() => { setRules([]); setRulesError(true); }).finally(() => setRulesLoading(false));
  }, []);

  useEffect(() => {
    vehicleAPI.list().then(r => {
      const d = r.data?.data?.vehicles ?? r.data?.vehicles ?? r.data?.data ?? r.data;
      setVehicles(Array.isArray(d) ? d : []);
    }).catch(() => {});
    geofenceAPI.list().then(r => {
      const d = r.data?.data?.geofences ?? r.data?.geofences ?? r.data?.data ?? r.data;
      setGeofences(Array.isArray(d) ? d : []);
    }).catch(() => {});
    loadRules();
  }, [loadRules]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.geofence_id) return toast.error("Select a geofence");
    setSaving(true);
    try {
      await alertAPI.configure({
        vehicle_id: form.vehicle_id || null,
        geofence_id: form.geofence_id,
        event_type: form.event_type,
      });
      toast.success("Alert rule saved");
      setForm(f => ({ ...f, vehicle_id: "", geofence_id: "" }));
      loadRules();
    } catch {
      toast.error("Failed to save alert rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "var(--bg-subtle)", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={20} color="#2563EB" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>Alert Rules</h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Choose which geofence events trigger live alerts</p>
        </div>
      </div>

      <form onSubmit={save} style={{ ...card, padding: "18px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={label}>Vehicle</label>
          <select style={input} value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.vehicle_id || v.id} value={v.vehicle_id || v.id}>{v.vehicle_number} — {v.driver_name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={label}>Geofence</label>
          <select style={input} value={form.geofence_id} onChange={e => setForm(f => ({ ...f, geofence_id: e.target.value }))}>
            <option value="">Select geofence</option>
            {geofences.map(g => <option key={g.geofence_id || g.id} value={g.geofence_id || g.id}>{g.geofence_name || g.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={label}>Event Type</label>
          <select style={{ ...input, minWidth: 140 }} value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
            <option value="entry">Entry</option>
            <option value="exit">Exit</option>
            <option value="both">Both</option>
          </select>
        </div>
        <button type="submit" disabled={saving} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: saving ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", height: 38 }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft)", fontSize: "0.88rem", fontWeight: 600, color: "var(--text)" }}>
          Configured Rules ({rules.length})
        </div>
        {rulesLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
          </div>
        ) : rulesError ? (
          <ErrorState title="Couldn't load alert rules" onRetry={loadRules} />
        ) : rules.length === 0 ? (
          <EmptyState icon={Bell} title="No alert rules configured yet" text="Create a rule above to get notified on geofence entry or exit." />
        ) : (
          <table className="dt">
            <thead>
              <tr style={{ background: "var(--bg-subtle)" }}>
                {["Vehicle", "Geofence", "Event", "Created"].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id || i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--text)", fontWeight: 600 }}>{r.vehicle_number || "All vehicles"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--text-2)" }}>{r.geofence_name || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>{(r.event_type || "").toUpperCase()}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.73rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
