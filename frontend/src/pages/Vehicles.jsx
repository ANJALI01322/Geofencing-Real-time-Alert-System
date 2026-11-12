import { useEffect, useState } from "react";
import { vehicleAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, Truck, User, Phone, Tag, X, ChevronRight } from "lucide-react";

const TYPES = ["truck", "van", "bike", "car", "bus"];
const TYPE_COLORS = { truck:"badge-indigo", van:"badge-cyan", bike:"badge-green", car:"badge-amber", bus:"badge-purple" };

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicle_number: "", vehicle_type: "truck", driver_name: "", driver_phone: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => vehicleAPI.list().then(r => { const d = r.data?.data ?? r.data; setVehicles(Array.isArray(d) ? d : []); });
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await vehicleAPI.create(form);
      toast.success("Vehicle registered!");
      setForm({ vehicle_number: "", vehicle_type: "truck", driver_name: "", driver_phone: "" });
      setShowForm(false);
      load();
    } catch { toast.error("Registration failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #06b6d4, #0891b2)" }} />
            <h1 className="page-title">Fleet Vehicles</h1>
          </div>
          <p className="page-subtitle">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} registered in fleet</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Register Vehicle"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass card-glow-indigo" style={{ padding: 28, marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0", marginBottom: 20 }}>New Vehicle Registration</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="form-label">Vehicle Number *</label>
              <input className="form-input" placeholder="e.g. DL01AB1234" required
                value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="form-label">Vehicle Type *</label>
              <select className="form-input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Driver Name</label>
              <input className="form-input" placeholder="Full name" value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Driver Phone</label>
              <input className="form-input" placeholder="+91 XXXXX XXXXX" value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Registering..." : "Register Vehicle"}
                {!loading && <ChevronRight size={16} />}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
          <Truck size={16} color="#6366f1" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8" }}>Registered Fleet</span>
        </div>
        {vehicles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
            <div style={{ color: "#334155", fontWeight: 600, fontSize: "0.9rem" }}>No vehicles registered yet</div>
            <div style={{ color: "#1e293b", fontSize: "0.8rem", marginTop: 4 }}>Click "Register Vehicle" to add your first fleet vehicle</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Driver</th>
                <th>Phone</th>
                <th>Last Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <Truck size={16} color="#818cf8" />
                      </div>
                      <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{v.vehicle_number}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${TYPE_COLORS[v.vehicle_type] || "badge-indigo"}`}>{v.vehicle_type}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <User size={13} color="#475569" />
                      <span>{v.driver_name || <span style={{ color: "#334155" }}>—</span>}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={13} color="#475569" />
                      <span>{v.driver_phone || <span style={{ color: "#334155" }}>—</span>}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#64748b" }}>
                    {v.last_location ? `${v.last_location.latitude?.toFixed(4)}, ${v.last_location.longitude?.toFixed(4)}` : <span style={{ color: "#1e293b" }}>Not tracked</span>}
                  </td>
                  <td>
                    <span className={v.last_location ? "badge badge-green" : "badge badge-red"}>
                      {v.last_location ? "● Active" : "○ Idle"}
                    </span>
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
