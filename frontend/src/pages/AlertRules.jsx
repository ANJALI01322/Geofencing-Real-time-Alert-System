import { useEffect, useState, useCallback } from "react";
import { vehicleAPI, geofenceAPI, alertAPI } from "../api";
import toast from "react-hot-toast";
import { Bell } from "lucide-react";

const card = { background: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const label = { fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" };
const input = { fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#374151", outline: "none", minWidth: 200 };

export default function AlertRules() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ vehicle_id: "", geofence_id: "", event_type: "both" });
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(() => {
    alertAPI.list().then(r => {
      const d = r.data?.data?.alert_rules ?? r.data?.alert_rules ?? r.data?.data ?? r.data;
      setRules(Array.isArray(d) ? d : []);
    }).catch(() => setRules([]));
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
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={20} color="#2563EB" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: 0 }}>Alert Rules</h1>
          <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: 0, marginTop: 2 }}>Choose which geofence events trigger live alerts</p>
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
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", fontSize: "0.88rem", fontWeight: 600, color: "#111827" }}>
          Configured Rules ({rules.length})
        </div>
        {rules.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: "0.82rem", color: "#9CA3AF" }}>No alert rules configured yet</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Vehicle", "Geofence", "Event", "Created"].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id || i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "#111827", fontWeight: 600 }}>{r.vehicle_number || "All vehicles"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "#374151" }}>{r.geofence_name || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>{(r.event_type || "").toUpperCase()}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.73rem", color: "#6B7280", fontFamily: "monospace" }}>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
