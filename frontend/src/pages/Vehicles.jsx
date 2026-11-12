import { useEffect, useState } from "react";
import { vehicleAPI, locationAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, X, Truck, User, Phone, MapPin, Circle, ChevronRight, Navigation } from "lucide-react";

const TYPES = ["truck", "van", "bike", "car", "bus"];
const TYPE_COLOR = { truck:"badge-blue", van:"badge-cyan", bike:"badge-green", car:"badge-amber", bus:"badge-indigo" };

function StatusDot({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div className="dot-wrap" style={{ width: 8, height: 8 }}>
        {active && <div className="live-ring" style={{ background: "var(--green)" }} />}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: active ? "var(--green)" : "var(--text-3)",
          position: "relative", zIndex: 1,
        }} className={active ? "blink" : ""} />
      </div>
      <span style={{ fontSize: "0.72rem", color: active ? "var(--green)" : "var(--text-3)", fontFamily: "JetBrains Mono", fontWeight: 600 }}>
        {active ? "ONLINE" : "OFFLINE"}
      </span>
    </div>
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicle_number: "", vehicle_type: "truck", driver_name: "", driver_phone: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [simVehicle, setSimVehicle] = useState("");
  const [simulating, setSimulating] = useState(false);

  const load = () => vehicleAPI.list().then(r => {
    const d = r.data?.data ?? r.data;
    setVehicles(Array.isArray(d) ? d : []);
  });

  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await vehicleAPI.create(form);
      toast.success(`Vehicle ${form.vehicle_number} registered`);
      setForm({ vehicle_number: "", vehicle_type: "truck", driver_name: "", driver_phone: "" });
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
    <div className="page-wrap content-scroll">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 24, background: "var(--blue)", borderRadius: 2, boxShadow: "0 0 8px var(--blue)" }} />
            <h1 className="page-heading">Fleet Registry</h1>
          </div>
          <p className="page-sub">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} · {vehicles.filter(v => v.last_location).length} active</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cancel" : "Add Vehicle"}
          </button>
        </div>
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
                value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} />
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
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
            </select>
            <button className="btn-ghost" onClick={simulate} disabled={simulating || !simVehicle}>
              {simulating ? "Simulating…" : <><Navigation size={13} /> Simulate Route</>}
            </button>
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
              8 random GPS points around New Delhi
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Truck size={14} color="var(--blue)" />
            <span className="panel-title">Fleet Registry</span>
          </div>
          <span className="badge badge-blue">{vehicles.length} total</span>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Truck size={36} color="var(--text-3)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>No vehicles registered</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 4, opacity: 0.6 }}>Add your first fleet vehicle above</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Plate / ID</th>
                <th>Type</th>
                <th>Driver</th>
                <th>Contact</th>
                <th>Coordinates</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6,
                        background: "rgba(14,165,233,0.08)",
                        border: "1px solid rgba(14,165,233,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Truck size={14} color="var(--blue)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "0.85rem", fontFamily: "Space Grotesk" }}>
                          {v.vehicle_number}
                        </div>
                        <div className="mono text-muted" style={{ fontSize: "0.62rem" }}>
                          {v.id?.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${TYPE_COLOR[v.vehicle_type] || "badge-slate"}`}>
                      {v.vehicle_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <User size={12} color="var(--text-3)" />
                      <span style={{ color: v.driver_name ? "var(--text-2)" : "var(--text-3)" }}>
                        {v.driver_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={12} color="var(--text-3)" />
                      <span className="mono" style={{ fontSize: "0.78rem", color: v.driver_phone ? "var(--text-2)" : "var(--text-3)" }}>
                        {v.driver_phone || "—"}
                      </span>
                    </div>
                  </td>
                  <td>
                    {v.last_location ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={11} color="var(--blue)" />
                        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
                          {v.last_location.latitude?.toFixed(5)}, {v.last_location.longitude?.toFixed(5)}
                        </span>
                      </div>
                    ) : (
                      <span className="mono text-muted" style={{ fontSize: "0.75rem" }}>No data</span>
                    )}
                  </td>
                  <td><StatusDot active={!!v.last_location} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
