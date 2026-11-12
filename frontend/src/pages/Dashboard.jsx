import { useEffect, useState, useRef } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import { Truck, Hexagon, AlertOctagon, Activity, ArrowUp, ArrowDown, Clock, Satellite, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

function StatTile({ icon: Icon, label, value, sub, color, delta }) {
  return (
    <div className={`stat-tile ${color}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value ?? "—"}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
        <div style={{
          width: 38, height: 38,
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: color === "blue"  ? "rgba(14,165,233,0.12)"  :
                      color === "amber" ? "rgba(245,158,11,0.12)"  :
                      color === "green" ? "rgba(34,197,94,0.12)"   :
                                         "rgba(239,68,68,0.12)",
          border: `1px solid ${
            color === "blue"  ? "rgba(14,165,233,0.2)"  :
            color === "amber" ? "rgba(245,158,11,0.2)"  :
            color === "green" ? "rgba(34,197,94,0.2)"   :
                               "rgba(239,68,68,0.2)"}`,
          flexShrink: 0,
        }}>
          <Icon size={18} color={
            color === "blue"  ? "var(--blue)"  :
            color === "amber" ? "var(--amber)" :
            color === "green" ? "var(--green)" : "var(--red)"} />
        </div>
      </div>
    </div>
  );
}

function EventRow({ v, idx }) {
  const isEntry = v.event_type === "entry";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "80px 1fr 1fr 110px",
      gap: 12,
      alignItems: "center",
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)",
      fontSize: "0.78rem",
      transition: "background 0.1s",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span className={`badge ${isEntry ? "badge-green" : "badge-red"}`} style={{ justifySelf: "start" }}>
        {isEntry ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
        {isEntry ? "ENTRY" : "EXIT"}
      </span>
      <span style={{ color: "var(--text-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {v.vehicle_number || "Unknown"}
      </span>
      <span style={{ color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {v.geofence_name || "—"}
      </span>
      <span style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono", fontSize: "0.7rem", justifySelf: "end" }}>
        {v.triggered_at ? formatDistanceToNow(new Date(v.triggered_at), { addSuffix: true }) : "just now"}
      </span>
    </div>
  );
}

function LiveEventRow({ a }) {
  const isEntry = a.event_type === "entry";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 20px",
      borderBottom: "1px solid var(--border)",
      fontSize: "0.78rem",
    }}>
      <span className={`badge ${isEntry ? "badge-green" : "badge-amber"}`} style={{ flexShrink: 0 }}>
        {isEntry ? "▲" : "▼"}{a.event_type?.toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.vehicle_number || "Vehicle"}
        </div>
        <div style={{ color: "var(--text-3)", fontSize: "0.68rem", fontFamily: "JetBrains Mono" }}>
          {a.latitude?.toFixed(5)}, {a.longitude?.toFixed(5)}
        </div>
      </div>
      <div style={{ flexShrink: 0, fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>
        {format(new Date(), "HH:mm:ss")}
      </div>
    </div>
  );
}

export default function Dashboard({ alertHistory }) {
  const [stats, setStats] = useState({ vehicles: 0, active: 0, geofences: 0, alerts: 0 });
  const [recentViolations, setRecentViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      vehicleAPI.list(),
      geofenceAPI.list(),
      violationAPI.history({ limit: 10 }),
    ]).then(([vRes, gRes, aRes]) => {
      const vehicles   = Array.isArray(vRes.data?.data) ? vRes.data.data : Array.isArray(vRes.data) ? vRes.data : [];
      const geofences  = Array.isArray(gRes.data?.data) ? gRes.data.data : Array.isArray(gRes.data) ? gRes.data : [];
      const violations = Array.isArray(aRes.data?.data) ? aRes.data.data : Array.isArray(aRes.data) ? aRes.data : [];
      setStats({
        vehicles: vehicles.length,
        active: vehicles.filter(v => v.last_location).length,
        geofences: geofences.length,
        alerts: violations.length,
      });
      setRecentViolations(violations);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-wrap bg-grid content-scroll">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 3, height: 24,
              background: "var(--blue)",
              borderRadius: 2,
              boxShadow: "0 0 8px var(--blue)",
            }} />
            <h1 className="page-heading">Fleet Overview</h1>
          </div>
          <p className="page-sub">
            Real-time vehicle monitoring &amp; geofence intelligence
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="dot-wrap" style={{ width: 7, height: 7 }}>
              <div className="live-ring" style={{ background: "var(--green)" }} />
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", position: "relative", zIndex: 1 }} className="blink" />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--green)", fontFamily: "JetBrains Mono", fontWeight: 600 }}>LIVE</span>
          </div>
          <div style={{ padding: "6px 12px", borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border)", fontSize: "0.7rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>
            {new Date().toLocaleTimeString("en-GB", { hour12: false })}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatTile icon={Truck}        label="Total Vehicles"   value={stats.vehicles}  sub={`${stats.active} with GPS`} color="blue" />
        <StatTile icon={Satellite}    label="Active Tracking"  value={stats.active}    sub="Location updated"            color="green" />
        <StatTile icon={Hexagon}      label="Geofence Zones"   value={stats.geofences} sub="Monitored areas"             color="amber" />
        <StatTile icon={AlertOctagon} label="Violations"       value={stats.alerts}    sub="Total recorded"              color="red" />
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Violation Log */}
        <div className="panel">
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertOctagon size={14} color="var(--amber)" />
              <span className="panel-title">Violation Log</span>
            </div>
            <span className="badge badge-amber">
              {recentViolations.length} events
            </span>
          </div>
          {/* Col headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 1fr 110px",
            gap: 12,
            padding: "7px 20px",
            background: "var(--bg-base)",
            borderBottom: "1px solid var(--border)",
          }}>
            {["Event", "Vehicle", "Zone", "Time"].map(h => (
              <span key={h} style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "Space Grotesk" }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="shimmer" style={{ height: 44, margin: "1px 0" }} />
              ))
            ) : recentViolations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <Activity size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>No violations recorded</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 4, opacity: 0.6 }}>Trigger a geofence to see events here</div>
              </div>
            ) : recentViolations.map((v, i) => <EventRow key={v.id || i} v={v} idx={i} />)}
          </div>
        </div>

        {/* Live Alert Feed */}
        <div className="panel">
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} color="var(--blue)" />
              <span className="panel-title">Live Alert Feed</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="dot-wrap" style={{ width: 7, height: 7 }}>
                <div className="live-ring" style={{ background: "var(--blue)" }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", position: "relative", zIndex: 1 }} className="blink" />
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--blue)", fontFamily: "JetBrains Mono", fontWeight: 600 }}>WebSocket</span>
            </div>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr auto",
            gap: 12,
            padding: "7px 20px",
            background: "var(--bg-base)",
            borderBottom: "1px solid var(--border)",
          }}>
            {["Event", "Details", "Time"].map(h => (
              <span key={h} style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "Space Grotesk" }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {alertHistory && alertHistory.length > 0 ? (
              alertHistory.slice(0, 20).map((a, i) => <LiveEventRow key={i} a={a} />)
            ) : (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <Satellite size={28} color="var(--text-3)" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Awaiting WebSocket events…</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 4, opacity: 0.6 }}>Move a vehicle into a zone to trigger</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
