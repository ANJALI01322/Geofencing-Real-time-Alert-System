import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { vehicleAPI, geofenceAPI, locationAPI } from "../api";
import toast from "react-hot-toast";
import { Navigation, Send, Zap } from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: null, iconUrl: null, shadowUrl: null });

const POLY_COLORS = { warehouse:"#6366f1", restricted:"#f43f5e", delivery:"#10b981", depot:"#f59e0b", custom:"#8b5cf6" };

function createTruckIcon(color = "#6366f1") {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};
      border:3px solid rgba(255,255,255,0.9);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 14px ${color}88, 0 0 0 4px ${color}33;
      font-size:16px;
    ">🚛</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 14, { duration: 1 }); }, [pos]);
  return null;
}

export default function LiveTracking({ lastAlert, connected }) {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [form, setForm] = useState({ vehicle_id: "", lat: "", lng: "", speed: "0" });
  const [markers, setMarkers] = useState({});
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    vehicleAPI.list().then(r => { const v = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []; setVehicles(v); if (v.length) setForm(f => ({ ...f, vehicle_id: v[0].id })); });
    geofenceAPI.list().then(r => { const d = r.data?.data ?? r.data; setGeofences(Array.isArray(d) ? d : []); });
  }, []);

  useEffect(() => {
    if (lastAlert) {
      setMarkers(m => ({ ...m, [lastAlert.vehicle_id]: { lat: lastAlert.latitude, lng: lastAlert.longitude } }));
      setFlyTo([lastAlert.latitude, lastAlert.longitude]);
    }
  }, [lastAlert]);

  const send = async e => {
    e.preventDefault();
    try {
      await locationAPI.update({ vehicle_id: form.vehicle_id, latitude: parseFloat(form.lat), longitude: parseFloat(form.lng), speed: parseFloat(form.speed) });
      setMarkers(m => ({ ...m, [form.vehicle_id]: { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } }));
      setFlyTo([parseFloat(form.lat), parseFloat(form.lng)]);
      toast.success("Location pushed!");
    } catch { toast.error("Failed to push location"); }
  };

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #10b981, #059669)" }} />
            <h1 className="page-title">Live Tracking</h1>
          </div>
          <p className="page-subtitle">Real-time vehicle positions on interactive map</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            {connected && <div style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#10b981", opacity: 0.4 }} className="ping-slow" />}
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: connected ? "#10b981" : "#ef4444" }} />
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: connected ? "#34d399" : "#f87171" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* Map */}
        <div className="glass" style={{ overflow: "hidden", padding: 0 }}>
          <MapContainer center={[28.47, 77.5]} zoom={11} style={{ height: 520, width: "100%", borderRadius: 16 }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="©OpenStreetMap ©Carto" />
            {flyTo && <FlyTo pos={flyTo} />}
            {geofences.map(g => g.coordinates?.length >= 3 && (
              <Polygon key={g.id}
                positions={g.coordinates.map(c => [c.lat ?? c[0], c.lng ?? c[1]])}
                pathOptions={{ color: POLY_COLORS[g.category] || "#6366f1", fillColor: POLY_COLORS[g.category] || "#6366f1", fillOpacity: 0.1, weight: 2 }}>
                <Popup>{g.name} <span className="badge badge-indigo">{g.category}</span></Popup>
              </Polygon>
            ))}
            {Object.entries(markers).map(([vid, pos]) => {
              const v = vehicles.find(x => x.id === vid);
              return (
                <Marker key={vid} position={[pos.lat, pos.lng]} icon={createTruckIcon()}>
                  <Popup>
                    <div style={{ background: "#1a2234", color: "#e2e8f0", borderRadius: 8, padding: 8, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{v?.vehicle_number || vid}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Send location panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="glass card-glow-cyan" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #06b6d4, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={15} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.875rem" }}>Push Location</div>
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>Simulate GPS update</div>
              </div>
            </div>
            <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Vehicle</label>
                <select className="form-input" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Latitude</label>
                <input className="form-input" type="number" step="any" placeholder="28.4700" required
                  value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input className="form-input" type="number" step="any" placeholder="77.5000" required
                  value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Speed (km/h)</label>
                <input className="form-input" type="number" placeholder="0" value={form.speed}
                  onChange={e => setForm(f => ({ ...f, speed: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 4 }}>
                <Zap size={15} /> Push Update
              </button>
            </form>
          </div>

          {/* Legend */}
          <div className="glass-sm" style={{ padding: 16 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Zone Legend</div>
            {Object.entries(POLY_COLORS).map(([cat, color]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "capitalize" }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
