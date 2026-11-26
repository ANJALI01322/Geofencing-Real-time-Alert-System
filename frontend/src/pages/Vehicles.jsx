import { useEffect, useState } from "react";
import { vehicleAPI, locationAPI } from "../api";
import toast from "react-hot-toast";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { Plus, X, Truck, User, Phone, ChevronRight, Navigation } from "lucide-react";

const TYPES = ["truck", "van", "bike", "car", "bus"];
const TYPE_STYLE = {
  truck:   { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  van:     { bg: "#ECFEFF", color: "#0E7490", border: "#A5F3FC" },
  bike:    { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  car:     { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  bus:     { bg: "#EEF2FF", color: "#4338CA", border: "#C7D2FE" },
  default: { bg: "#F3F4F6", color: "var(--text-2)", border: "var(--border)" },
};
export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicle_number: "", vehicle_type: "truck", driver_name: "", phone_number: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [simVehicle, setSimVehicle] = useState("");
  const [simulating, setSimulating] = useState(false);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const load = () => {
    setListError(false);
    return vehicleAPI.list().then(r => {
      const d = r.data?.data?.vehicles ?? r.data?.vehicles ?? r.data?.data ?? r.data;
      setVehicles(Array.isArray(d) ? d : []);
    }).catch(() => setListError(true)).finally(() => setListLoading(false));
  };

  useEffect(() => { load(); }, []);

  const vid = v => v.vehicle_id || v.id;
  const hasLoc = v => !!(v.last_location || v.latitude || v.longitude || v.location || v.last_lat);
  const anyLoc = vehicles.some(hasLoc);
  // Temporary: if no vehicle reports a location, treat all as active (simulator tracks all)
  const isActive = v => (anyLoc ? hasLoc(v) : true);
  const activeCount = vehicles.filter(isActive).length;
  const offlineCount = vehicles.length - activeCount;

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await vehicleAPI.create(form);
      toast.success(`Vehicle ${form.vehicle_number} registered`);
      setForm({ vehicle_number: "", vehicle_type: "truck", driver_name: "", phone_number: "" });
      setShowForm(false);
      load();
    } catch { toast.error("Registration failed"); }
    finally { setLoading(false); }
  };

  const simulate = async () => {
    if (!simVehicle) return toast.error("Select a vehicle first");
    setSimulating(true);
    const base = { lat: 28.6139, lng: 77.2090 };
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const lat = base.lat + (Math.random() - 0.5) * 0.05;
      const lng = base.lng + (Math.random() - 0.5) * 0.05;
      try {
        await locationAPI.update({ vehicle_id: simVehicle, latitude: lat, longitude: lng });
      } catch {}
      await new Promise(r => setTimeout(r, 600));
    }
    toast.success("Location simulation complete");
    setSimulating(false);
    load();
  };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100%", background: "var(--bg-subtle)", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ height: 3, background: "linear-gradient(90deg,#3B82F6,#22C55E)", margin: "-28px -32px 25px" }} />
            {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Truck size={20} color="#2563EB" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>Fleet Registry</h1>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2, marginBottom: 0 }}>Manage vehicles, drivers and live status</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: showForm ? "#6B7280" : "#2563EB", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "Add Vehicle"}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Vehicles", value: vehicles.length, bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8", dot: "#3B82F6" },
          { label: "Active", value: activeCount, bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D", dot: "#22C55E" },
          { label: "Offline", value: offlineCount, bg: "#F3F4F6", border: "var(--border)", color: "var(--text-2)", dot: "#9CA3AF" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 10, background: s.bg, border: `1px solid ${s.border}` }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />
            <span style={{ fontSize: "1.3rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>{listLoading ? "–" : s.value}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <span className="panel-title">Register New Vehicle</span>
          </div>
          <form onSubmit={submit} style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Plate Number *</label>
              <input className="form-input" placeholder="e.g. DL01AB1234" required
                value={form.vehicle_number}
                onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="form-label">Vehicle Type *</label>
              <select className="form-input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Driver Name</label>
              <input className="form-input" placeholder="Full name"
                value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Driver Phone</label>
              <input className="form-input" placeholder="+91 XXXXX XXXXX"
                value={form.driver_phone} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Registering…" : <>Register <ChevronRight size={14} /></>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Simulate panel */}
      {vehicles.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Navigation size={14} color="var(--amber)" />
              <span className="panel-title">GPS Simulation</span>
            </div>
            <span className="badge badge-amber">Dev Tool</span>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", gap: 10, alignItems: "center" }}>
            <select className="form-input" style={{ maxWidth: 220 }} value={simVehicle} onChange={e => setSimVehicle(e.target.value)}>
              <option value="">Select vehicle…</option>
              {vehicles.map(v => <option key={vid(v)} value={vid(v)}>{v.vehicle_number}</option>)}
            </select>
            <button className="btn-ghost" onClick={simulate} disabled={simulating || !simVehicle} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              {simulating ? "Simulating…" : <><Navigation size={13} /> Simulate Route</>}
            </button>
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
              8 random GPS points around New Delhi
            </span>
          </div>
        </div>
      )}

      {/* Vehicle cards */}
      {listLoading && vehicles.length === 0 ? (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 170 }} />)}
        </div>
      ) : listError && vehicles.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
          <ErrorState onRetry={load} />
        </div>
      ) : vehicles.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)" }}>
          <EmptyState icon={Truck} title="No vehicles in fleet" text="Add your first vehicle to start tracking">
            <button onClick={() => setShowForm(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, padding: "10px 18px", borderRadius: "var(--r-md)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} /> Add Vehicle
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {vehicles.map(v => {
            const active = isActive(v);
            const tc = TYPE_STYLE[v.vehicle_type] || TYPE_STYLE.default;
            return (
              <div key={vid(v)} className="gt-card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={19} color="#2563EB" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div title={v.vehicle_number} style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", fontFamily: "var(--font-mono)", letterSpacing: "0", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.vehicle_number}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#22C55E" : "#9CA3AF" }} />
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: active ? "#16A34A" : "#6B7280", letterSpacing: "0.06em" }}>{active ? "ACTIVE" : "OFFLINE"}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} color="#9CA3AF" style={{ flexShrink: 0 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.82rem", color: v.driver_name ? "#374151" : "#9CA3AF" }}>
                    <User size={13} color="#9CA3AF" /> {v.driver_name || "No driver assigned"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    <Phone size={13} color="#9CA3AF" /> {v.phone_number || v.driver_phone || "—"}
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                    {v.vehicle_type || "vehicle"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
