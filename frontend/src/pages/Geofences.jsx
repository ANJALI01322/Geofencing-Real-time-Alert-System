import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup, Polygon, Tooltip } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { geofenceAPI } from "../api";
import toast from "react-hot-toast";
import { Plus, X, Hexagon, Layers, ChevronRight } from "lucide-react";

const CATEGORIES = ["restricted", "parking", "warehouse", "delivery", "custom"];
const CAT_COLOR = { restricted:"badge-red", parking:"badge-blue", warehouse:"badge-amber", delivery:"badge-green", custom:"badge-slate" };

export default function Geofences() {
  const [geofences, setGeofences] = useState([]);
  const [form, setForm] = useState({ name: "", category: "custom", description: "" });
  const [pendingCoords, setPendingCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => geofenceAPI.list().then(r => {
    const d = r.data?.data ?? r.data;
    setGeofences(Array.isArray(d) ? d : []);
  });

  useEffect(() => { load(); }, []);

  const onCreated = e => {
    const latlngs = e.layer.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }));
    setPendingCoords(latlngs);
    setShowForm(true);
    toast("Zone drawn — fill in the details", { icon: "📍" });
  };

  const save = async e => {
    e.preventDefault();
    if (!pendingCoords) return toast.error("Draw a zone on the map first");
    setLoading(true);
    try {
      await geofenceAPI.create({ ...form, coordinates: pendingCoords });
      toast.success(`Zone "${form.name}" created`);
      setForm({ name: "", category: "custom", description: "" });
      setPendingCoords(null);
      setShowForm(false);
      load();
    } catch { toast.error("Failed to create zone"); }
    finally { setLoading(false); }
  };

  const polyColor = cat =>
    cat === "restricted" ? "#ef4444" :
    cat === "parking"    ? "#0ea5e9" :
    cat === "warehouse"  ? "#f59e0b" :
    cat === "delivery"   ? "#22c55e" : "#94a3b8";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-base)", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-base)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 20, background: "var(--amber)", borderRadius: 2, boxShadow: "0 0 8px var(--amber)" }} />
          <div>
            <h1 style={{ fontFamily: "Space Grotesk", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.2 }}>
              Geofence Zones
            </h1>
            <p className="page-sub">{geofences.length} zone{geofences.length !== 1 ? "s" : ""} · draw polygons on the map</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingCoords && (
            <span className="badge badge-amber" style={{ padding: "5px 10px" }}>
              ✦ Zone drawn — fill form
            </span>
          )}
          {showForm && (
            <button className="btn-ghost" onClick={() => { setShowForm(false); setPendingCoords(null); }}>
              <X size={13} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer
            center={[28.6139, 77.2090]}
            zoom={12}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CartoDB"
            />
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={onCreated}
                draw={{
                  polygon: { shapeOptions: { color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.15, weight: 2 } },
                  rectangle: false, circle: false, marker: false, circlemarker: false, polyline: false,
                }}
              />
              {geofences.map(g => {
                const coords = g.coordinates?.map?.(c => [c.lat, c.lng]);
                if (!coords?.length) return null;
                const color = polyColor(g.category);
                return (
                  <Polygon
                    key={g.id}
                    positions={coords}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 2 }}
                  >
                    <Tooltip permanent direction="center" className="zone-tooltip">
                      <span style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 11, color: color }}>
                        {g.name}
                      </span>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </FeatureGroup>
          </MapContainer>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300,
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-base)",
          overflow: "hidden",
        }}>
          {/* Create form */}
          {showForm && (
            <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <Hexagon size={13} color="var(--amber)" />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-2)", fontFamily: "Space Grotesk", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  New Zone
                </span>
              </div>
              <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="form-label">Zone Name *</label>
                  <input className="form-input" placeholder="e.g. Warehouse A"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input className="form-input" placeholder="Optional note"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                {pendingCoords && (
                  <div style={{ padding: "8px 10px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 6 }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--blue)", fontFamily: "JetBrains Mono" }}>
                      ✓ {pendingCoords.length} vertices captured
                    </span>
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Saving…" : <>Save Zone <ChevronRight size={13} /></>}
                </button>
              </form>
            </div>
          )}

          {/* Zone list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px 8px",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Layers size={13} color="var(--text-3)" />
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "Space Grotesk" }}>
                  Zones ({geofences.length})
                </span>
              </div>
            </div>
            {geofences.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <Hexagon size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>No zones yet</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-3)", opacity: 0.6, marginTop: 4 }}>
                  Draw a polygon on the map
                </div>
              </div>
            ) : geofences.map(g => {
              const color = polyColor(g.category);
              return (
                <div key={g.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.1s",
                  cursor: "default",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}60` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)", fontFamily: "Space Grotesk", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: 2 }}>
                      {g.coordinates?.length || 0} vertices
                    </div>
                  </div>
                  <span className={`badge ${CAT_COLOR[g.category] || "badge-slate"}`} style={{ flexShrink: 0 }}>
                    {g.category}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "Space Grotesk" }}>
              Zone Types
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { label: "Restricted", color: "#ef4444" },
                { label: "Parking",    color: "#0ea5e9" },
                { label: "Warehouse",  color: "#f59e0b" },
                { label: "Delivery",   color: "#22c55e" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 10, height: 3, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
