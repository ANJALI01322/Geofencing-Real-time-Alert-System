import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { vehicleAPI, geofenceAPI } from "../api";
import toast from "react-hot-toast";
import { Navigation, Radio, Layers, ChevronRight } from "lucide-react";

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const makeIcon = color => L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 8px ${color}80;"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const VEHICLE_COLORS = {
  truck: "#0ea5e9", van: "#06b6d4", bike: "#22c55e",
  car: "#f59e0b", bus: "#a855f7",
};

// Delhi points for simulation
const DELHI_POINTS = [
  [28.6139, 77.2090], [28.6280, 77.2149], [28.5921, 77.2273],
  [28.6450, 77.1877], [28.6090, 77.2411], [28.5720, 77.2020],
  [28.6600, 77.2300], [28.5850, 77.1700], [28.6350, 77.1600],
];

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 14, { duration: 1 }); }, [pos]);
  return null;
}

export default function LiveTracking() {
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [positions, setPositions] = useState({});
  const [selected, setSelected] = useState(null);
  const [tracking, setTracking] = useState(false);
  const wsRef = useRef(null);
  const simRef = useRef(null);

  useEffect(() => {
    vehicleAPI.list().then(r => {
      const v = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
      setVehicles(v);
      // Set initial simulated positions
      const initPos = {};
      v.forEach((veh, i) => {
        const pt = DELHI_POINTS[i % DELHI_POINTS.length];
        initPos[veh.id] = { lat: pt[0], lng: pt[1] };
      });
      setPositions(initPos);
    });
    geofenceAPI.list().then(r => {
      const d = r.data?.data ?? r.data;
      setGeofences(Array.isArray(d) ? d : []);
    });
  }, []);

  // GPS simulation
  useEffect(() => {
    if (!tracking) { clearInterval(simRef.current); return; }
    simRef.current = setInterval(() => {
      setPositions(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          next[id] = {
            lat: next[id].lat + (Math.random() - 0.5) * 0.002,
            lng: next[id].lng + (Math.random() - 0.5) * 0.002,
          };
        });
        return next;
      });
    }, 1800);
    return () => clearInterval(simRef.current);
  }, [tracking]);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8080/ws`);
    wsRef.current = ws;
    ws.onopen = () => setTracking(true);
    ws.onmessage = e => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.vehicle_id && ev.latitude) {
          setPositions(p => ({ ...p, [ev.vehicle_id]: { lat: ev.latitude, lng: ev.longitude } }));
        }
      } catch {}
    };
    ws.onclose = () => { setTracking(false); setTimeout(() => {}, 3000); };
    return () => ws.close();
  }, []);

  const selVehicle = vehicles.find(v => v.id === selected);
  const selPos = selected ? positions[selected] : null;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-base)", overflow: "hidden" }}>

      {/* Left sidebar */}
      <div style={{
        width: 260,
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ width: 3, height: 18, background: "var(--green)", borderRadius: 2, boxShadow: "0 0 8px var(--green)" }} />
            <span style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: "1rem", color: "var(--text-1)" }}>
              Live Tracking
            </span>
            <span style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: "0.65rem", fontFamily: "JetBrains Mono",
              color: tracking ? "var(--green)" : "var(--text-3)",
            }}>
              <span style={{
                display: "inline-block",
                width: 6, height: 6, borderRadius: "50%",
                background: tracking ? "var(--green)" : "var(--text-3)",
                animation: tracking ? "blink 1.4s ease-in-out infinite" : "none",
              }} />
              {tracking ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <p style={{ fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "JetBrains Mono", marginLeft: 11 }}>
            {vehicles.length} units · Delhi NCR
          </p>
        </div>

        {/* Vehicle list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {vehicles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Navigation size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>No vehicles</div>
            </div>
          ) : vehicles.map(v => {
            const pos = positions[v.id];
            const color = VEHICLE_COLORS[v.vehicle_type] || "#94a3b8";
            const isSelected = selected === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelected(isSelected ? null : v.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-hover)" : "transparent",
                  borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
              >
                {/* Color dot with live ring */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }} />
                  {v.status === "online" && (
                    <div style={{
                      position: "absolute", inset: -3,
                      borderRadius: "50%",
                      border: `1.5px solid ${color}`,
                      animation: "live-ring 2s ease-out infinite",
                      opacity: 0,
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)", fontFamily: "Space Grotesk", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {v.vehicle_number}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "JetBrains Mono", marginTop: 1 }}>
                    {pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "—"}
                  </div>
                </div>
                <div style={{
                  fontSize: "0.6rem", fontFamily: "JetBrains Mono", fontWeight: 700, textTransform: "uppercase",
                  color: v.status === "online" ? "var(--green)" : "var(--text-3)",
                }}>
                  {v.status || "off"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Zone legend */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "Space Grotesk" }}>
            Fleet Types
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {Object.entries(VEHICLE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}80` }} />
                <span style={{ fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "JetBrains Mono", textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Overlay badge */}
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 1000,
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <div style={{
            padding: "5px 10px",
            background: "rgba(3,7,18,0.85)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            display: "flex", alignItems: "center", gap: 6,
            backdropFilter: "blur(8px)",
          }}>
            <Layers size={11} color="var(--text-3)" />
            <span style={{ fontSize: "0.65rem", fontFamily: "JetBrains Mono", color: "var(--text-2)" }}>
              {geofences.length} zones · {vehicles.length} units
            </span>
          </div>
          {!tracking && (
            <div style={{
              padding: "5px 10px",
              background: "rgba(3,7,18,0.85)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 6,
              backdropFilter: "blur(8px)",
            }}>
              <span style={{ fontSize: "0.65rem", fontFamily: "JetBrains Mono", color: "var(--red)" }}>
                ⚠ WebSocket offline — GPS simulation active
              </span>
            </div>
          )}
        </div>

        <MapContainer
          center={[28.6139, 77.2090]}
          zoom={12}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CartoDB"
          />
          {selPos && <FlyTo pos={[selPos.lat, selPos.lng]} />}

          {/* Geofence circles (approximation) */}
          {geofences.map(g => {
            if (!g.coordinates?.length) return null;
            const center = g.coordinates.reduce((acc, c) => [acc[0] + c.lat, acc[1] + c.lng], [0, 0]);
            const lat = center[0] / g.coordinates.length;
            const lng = center[1] / g.coordinates.length;
            const color = g.category === "restricted" ? "#ef4444" : g.category === "parking" ? "#0ea5e9" : "#f59e0b";
            return (
              <Circle
                key={g.id}
                center={[lat, lng]}
                radius={300}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.07, weight: 1.5, dashArray: "4 4" }}
              />
            );
          })}

          {/* Vehicle markers */}
          {vehicles.map(v => {
            const pos = positions[v.id];
            if (!pos) return null;
            const color = VEHICLE_COLORS[v.vehicle_type] || "#94a3b8";
            return (
              <Marker
                key={v.id}
                position={[pos.lat, pos.lng]}
                icon={makeIcon(selected === v.id ? "#fff" : color)}
                eventHandlers={{ click: () => setSelected(selected === v.id ? null : v.id) }}
              >
                <Popup>
                  <div style={{ fontFamily: "Space Grotesk", minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: color, fontSize: 13, marginBottom: 6 }}>
                      {v.vehicle_number}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
                      <div>Type: <span style={{ color: "#f0f6ff" }}>{v.vehicle_type}</span></div>
                      <div>Driver: <span style={{ color: "#f0f6ff" }}>{v.driver_name || "—"}</span></div>
                      <div>Status: <span style={{ color: v.status === "online" ? "#22c55e" : "#94a3b8" }}>{v.status}</span></div>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, marginTop: 4, color: "#475569" }}>
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Right detail panel (when vehicle selected) */}
      {selVehicle && selPos && (
        <div style={{
          width: 220,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-base)",
          display: "flex", flexDirection: "column",
          flexShrink: 0,
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: VEHICLE_COLORS[selVehicle.vehicle_type] || "#94a3b8", boxShadow: `0 0 6px ${VEHICLE_COLORS[selVehicle.vehicle_type] || "#94a3b8"}80` }} />
              <span style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>
                {selVehicle.vehicle_number}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Driver", selVehicle.driver_name || "—"],
                ["Type", selVehicle.vehicle_type],
                ["Status", selVehicle.status],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "Space Grotesk", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-1)", fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "Space Grotesk", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Live Coordinates</div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: "0.68rem", fontFamily: "JetBrains Mono", color: "var(--blue)", lineHeight: 1.8 }}>
                <div>LAT {selPos.lat.toFixed(6)}</div>
                <div>LNG {selPos.lng.toFixed(6)}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>
              Speed: <span style={{ color: "var(--amber)" }}>{Math.floor(Math.random() * 60 + 20)} km/h</span>
            </div>
          </div>
          <button
            onClick={() => setSelected(null)}
            style={{
              margin: "auto 16px 16px",
              padding: "8px 0",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-3)",
              fontSize: "0.72rem",
              fontFamily: "Space Grotesk",
              cursor: "pointer",
            }}
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
