import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geofenceAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, MapPin, Trash2, X, ChevronRight, Layers } from "lucide-react";

const CATEGORIES = ["warehouse", "restricted", "delivery", "depot", "custom"];
const CAT_COLORS = { warehouse:"badge-indigo", restricted:"badge-red", delivery:"badge-green", depot:"badge-amber", custom:"badge-purple" };
const POLY_COLORS = { warehouse:"#6366f1", restricted:"#f43f5e", delivery:"#10b981", depot:"#f59e0b", custom:"#8b5cf6" };

function PolygonDrawer({ points, setPoints }) {
  useMapEvents({
    click(e) { setPoints(p => [...p, [e.latlng.lat, e.latlng.lng]]); }
  });
  return points.length >= 3
    ? <Polygon positions={[...points, points[0]]} pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.15, weight: 2 }} />
    : null;
}

export default function Geofences() {
  const [geofences, setGeofences] = useState([]);
  const [points, setPoints] = useState([]);
  const [form, setForm] = useState({ name: "", category: "warehouse", description: "" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => geofenceAPI.list().then(r => { const d = r.data?.data ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    if (points.length < 3) { toast.error("Draw at least 3 points on the map"); return; }
    setLoading(true);
    try {
      await geofenceAPI.create({ ...form, coordinates: points.map(([lat, lng]) => ({ lat, lng })) });
      toast.success("Geofence created!");
      setPoints([]); setForm({ name: "", category: "warehouse", description: "" }); setShowForm(false); load();
    } catch { toast.error("Creation failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #8b5cf6, #7c3aed)" }} />
            <h1 className="page-title">Geofences</h1>
          </div>
          <p className="page-subtitle">Draw polygon zones to monitor vehicle boundaries</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Create Geofence"}
        </button>
      </div>

      {showForm && (
        <div className="glass card-glow-violet" style={{ padding: 28, marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>
            Define New Zone
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label">Zone Name *</label>
                  <input className="form-input" placeholder="e.g. Main Warehouse" required
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input className="form-input" placeholder="Optional note about this zone"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {points.map((p, i) => (
                    <span key={i} className="badge badge-indigo" style={{ cursor: "pointer", fontSize: "0.65rem" }}
                      onClick={() => setPoints(pts => pts.filter((_, j) => j !== i))}>
                      {p[0].toFixed(3)}, {p[1].toFixed(3)} ✕
                    </span>
                  ))}
                  {points.length === 0 && <span style={{ fontSize: "0.75rem", color: "#334155" }}>Click on the map to add polygon points →</span>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn-ghost" onClick={() => setPoints([])}>
                    <Trash2 size={14} /> Clear Points
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading || points.length < 3}>
                    {loading ? "Saving..." : "Save Geofence"} <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            </div>
            <div className="map-container" style={{ height: 320 }}>
              <MapContainer center={[28.47, 77.5]} zoom={11} style={{ height: "100%", width: "100%", borderRadius: 14 }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="©OpenStreetMap ©Carto" />
                <PolygonDrawer points={points} setPoints={setPoints} />
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Geofence list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {geofences.length === 0 ? (
          <div className="glass" style={{ gridColumn: "1/-1", padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ color: "#334155", fontWeight: 600 }}>No geofences created yet</div>
            <div style={{ color: "#1e293b", fontSize: "0.8rem", marginTop: 4 }}>Create your first monitoring zone</div>
          </div>
        ) : geofences.map(g => (
          <div key={g.id} className="glass-sm"
            style={{ padding: 20, transition: "transform 0.2s", cursor: "default" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${POLY_COLORS[g.category] || "#6366f1"}22`,
                  border: `1px solid ${POLY_COLORS[g.category] || "#6366f1"}44`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <MapPin size={16} color={POLY_COLORS[g.category] || "#6366f1"} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>{g.name}</div>
                  <span className={`badge ${CAT_COLORS[g.category] || "badge-indigo"}`} style={{ marginTop: 2 }}>{g.category}</span>
                </div>
              </div>
            </div>
            {g.description && <p style={{ fontSize: "0.75rem", color: "#475569", marginBottom: 10 }}>{g.description}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "#334155" }}>
              <Layers size={12} />
              {(g.coordinates?.length || 0)} polygon points
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
