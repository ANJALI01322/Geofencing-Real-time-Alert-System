import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { vehicleAPI, geofenceAPI, locationAPI } from "../api";
import toast from "react-hot-toast";
import { Navigation, Radio } from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const makeIcon = (color) =>
  L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 10px ${color};"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];
const DEFAULT_POS = { lat: 28.6139, lng: 77.209 };

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], 13, { duration: 1 });
  }, [pos]);
  return null;
}

export default function LiveTracking() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [positions, setPositions] = useState({});
  const [selected, setSelected] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsRef = useRef(null);
  const simRef = useRef(null);

  useEffect(() => {
    vehicleAPI
      .list()
      .then((r) => {
        const raw = r.data?.data?.vehicles ?? r.data?.vehicles ?? r.data?.data ?? r.data;
        const v = Array.isArray(raw) ? raw : [];
        setVehicles(v);
        const init = {};
        v.forEach((veh, i) => {
          const angle = (i / Math.max(v.length, 1)) * 2 * Math.PI;
          init[veh.vehicle_id] = {
            lat: DEFAULT_POS.lat + 0.02 * Math.sin(angle),
            lng: DEFAULT_POS.lng + 0.02 * Math.cos(angle),
          };
        });
        setPositions(init);
      })
      .catch(() => toast.error("Failed to load vehicles"));

    geofenceAPI
      .list()
      .then((r) => {
        const raw = r.data?.data?.geofences ?? r.data?.geofences ?? r.data?.data ?? r.data;
        setGeofences(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {});
  }, []);

  // GPS simulation — sends to backend for geofence detection & violations
  useEffect(() => {
    simRef.current = setInterval(() => {
      setPositions((prev) => {
        const next = {};
        Object.keys(prev).forEach((id) => {
          next[id] = {
            lat: prev[id].lat + (Math.random() - 0.5) * 0.003,
            lng: prev[id].lng + (Math.random() - 0.5) * 0.003,
          };
          locationAPI
            .update({ vehicle_id: id, latitude: next[id].lat, longitude: next[id].lng })
            .catch(() => {});
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(simRef.current);
  }, []);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`wss://geofencing-real-time-alert-system-h1vz.onrender.com/ws`);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus("live");
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.vehicle_id && ev.latitude != null) {
            setPositions((p) => ({
              ...p,
              [ev.vehicle_id]: { lat: ev.latitude, lng: ev.longitude },
            }));
          }
        } catch {}
      };
      ws.onclose = () => { setWsStatus("reconnecting"); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  const selPos = selected ? positions[selected] : null;
  const selVehicle = vehicles.find((v) => v.vehicle_id === selected);

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Radio size={14} color="var(--blue)" />
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-1)" }}>Live Fleet</span>
            <span style={{ marginLeft: "auto", fontSize: "0.6rem", padding: "2px 7px", borderRadius: 20, background: wsStatus === "live" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)", color: wsStatus === "live" ? "#22c55e" : "#f59e0b" }}>
              {wsStatus === "live" ? "● LIVE" : "● " + wsStatus.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-3)" }}>{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} tracked</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {vehicles.map((v, i) => {
            const pos = positions[v.vehicle_id];
            const color = COLORS[i % COLORS.length];
            return (
              <div key={v.vehicle_id} onClick={() => setSelected(v.vehicle_id === selected ? null : v.vehicle_id)}
                style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selected === v.vehicle_id ? "rgba(14,165,233,0.08)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text-1)", fontFamily: "Space Grotesk" }}>{v.vehicle_number}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-3)" }}>{v.driver_name}</div>
                  </div>
                  <Navigation size={11} color={color} />
                </div>
                {pos && (
                  <div style={{ marginTop: 4, fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}>
                    {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                  </div>
                )}
              </div>
            );
          })}
          {vehicles.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", fontSize: "0.75rem", color: "var(--text-3)" }}>
              No vehicles registered.<br />Add vehicles in Fleet section.
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[DEFAULT_POS.lat, DEFAULT_POS.lng]} zoom={12} style={{ width: "100%", height: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          {selPos && <FlyTo pos={selPos} />}

          {geofences.map((g) => {
            const coords = g.coordinates;
            if (!Array.isArray(coords) || coords.length < 3) return null;
            const pts = coords.map((c) => Array.isArray(c) ? [c[0], c[1]] : [c.lat, c.lng]);
            return (
              <Polygon key={g.geofence_id} positions={pts} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.1, weight: 2, dashArray: "6,4" }}>
                <Popup>{g.geofence_name}</Popup>
              </Polygon>
            );
          })}

          {vehicles.map((v, i) => {
            const pos = positions[v.vehicle_id];
            if (!pos || isNaN(pos.lat) || isNaN(pos.lng)) return null;
            const color = COLORS[i % COLORS.length];
            return (
              <Marker key={v.vehicle_id} position={[pos.lat, pos.lng]} icon={makeIcon(color)} eventHandlers={{ click: () => setSelected(v.vehicle_id) }}>
                <Popup>
                  <strong>{v.vehicle_number}</strong><br />{v.driver_name}<br />
                  <span style={{ fontSize: "0.75rem", color: "#666" }}>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {selVehicle && selPos && (
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, width: 220, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-1)", marginBottom: 8 }}>{selVehicle.vehicle_number}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-2)", marginBottom: 4 }}>👤 {selVehicle.driver_name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-2)", marginBottom: 8 }}>🚛 {selVehicle.vehicle_type}</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", color: "var(--blue)" }}>
              {selPos.lat.toFixed(5)}<br />{selPos.lng.toFixed(5)}
            </div>
            <div style={{ marginTop: 8, fontSize: "0.6rem", padding: "3px 8px", borderRadius: 20, background: "rgba(34,197,94,0.15)", color: "#22c55e", display: "inline-block" }}>● GPS ACTIVE</div>
          </div>
        )}
      </div>
    </div>
  );
}




