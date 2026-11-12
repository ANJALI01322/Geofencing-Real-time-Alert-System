import { useEffect, useState } from "react";
import { vehicleAPI, geofenceAPI, violationAPI } from "../api";
import { Truck, MapPin, AlertTriangle, Activity, TrendingUp, ArrowUpRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({ icon: Icon, label, value, sub, gradientFrom, gradientTo, glowClass, iconBg }) {
  return (
    <div className={`glass ${glowClass}`} style={{ padding: 24, transition: "transform 0.2s", cursor: "default" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            {label}
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f1f5f9", lineHeight: 1, letterSpacing: "-0.03em" }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 14px ${gradientFrom}44`,
          flexShrink: 0
        }}>
          <Icon size={22} color="white" />
        </div>
      </div>
      <div style={{ marginTop: 16, height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`, opacity: 0.5 }} />
    </div>
  );
}

function AlertItem({ alert }) {
  const isEntry = alert.event_type === "entry";
  return (
    <div className={`alert-item ${isEntry ? "alert-entry" : "alert-exit"}`}
      style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${isEntry ? "badge-green" : "badge-red"}`}>
            {isEntry ? "▲ ENTRY" : "▼ EXIT"}
          </span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0" }}>
            {alert.vehicle_number || "Unknown"}
          </span>
        </div>
        <span style={{ fontSize: "0.65rem", color: "#475569", display: "flex", alignItems: "center", gap: 3 }}>
          <Clock size={10} /> {alert.triggered_at ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true }) : "just now"}
        </span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
        📍 {alert.geofence_name || "Geofence"} &nbsp;·&nbsp; {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
      </div>
    </div>
  );
}

export default function Dashboard({ alertHistory }) {
  const [stats, setStats] = useState({ vehicles: 0, active: 0, geofences: 0, alerts: 0 });
  const [recentViolations, setRecentViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      vehicleAPI.list(),
      geofenceAPI.list(),
      violationAPI.history({ limit: 5 }),
    ]).then(([vRes, gRes, aRes]) => {
      const vehicles = Array.isArray(vRes.data?.data) ? vRes.data.data : Array.isArray(vRes.data) ? vRes.data : [];
      const geofences = Array.isArray(gRes.data?.data) ? gRes.data.data : Array.isArray(gRes.data) ? gRes.data : [];
      const violations = Array.isArray(aRes.data?.data) ? aRes.data.data : Array.isArray(aRes.data) ? aRes.data : [];
      setStats({
        vehicles: vehicles.length,
        active: vehicles.filter(v => v.last_location).length,
        geofences: geofences.length,
        alerts: violations.length,
      });
      setRecentViolations(violations.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh", background: "#0a0f1e" }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #6366f1, #8b5cf6)" }} />
          <h1 className="page-title">Fleet Overview</h1>
        </div>
        <p className="page-subtitle">Real-time monitoring &amp; geofence intelligence</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
        <StatCard icon={Truck}       label="Total Vehicles"  value={stats.vehicles}  sub="Registered fleet"   gradientFrom="#6366f1" gradientTo="#8b5cf6" glowClass="card-glow-indigo" />
        <StatCard icon={TrendingUp}  label="Active Vehicles" value={stats.active}    sub="With location data" gradientFrom="#06b6d4" gradientTo="#0891b2" glowClass="card-glow-cyan" />
        <StatCard icon={MapPin}      label="Geofences"       value={stats.geofences} sub="Monitored zones"    gradientFrom="#8b5cf6" gradientTo="#7c3aed" glowClass="card-glow-violet" />
        <StatCard icon={AlertTriangle} label="Total Alerts"  value={stats.alerts}    sub="Recent events"      gradientFrom="#f43f5e" gradientTo="#e11d48" glowClass="card-glow-rose" />
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Recent Violations */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f1f5f9" }}>Recent Violations</h2>
              <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 2 }}>{recentViolations.length} records loaded</p>
            </div>
            <span className="badge badge-amber">
              <Activity size={10} /> Live
            </span>
          </div>
          {loading ? (
            <div>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 56, borderRadius: 10, marginBottom: 8 }} />)}</div>
          ) : recentViolations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
              <div style={{ color: "#334155", fontSize: "0.875rem", fontWeight: 500 }}>No violations recorded yet</div>
              <div style={{ color: "#1e293b", fontSize: "0.75rem", marginTop: 4 }}>Move a vehicle into a geofence zone</div>
            </div>
          ) : recentViolations.map((v, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
              borderBottom: i < recentViolations.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none"
            }}>
              <span className={`badge ${v.event_type === "entry" ? "badge-green" : "badge-red"}`}>
                {v.event_type?.toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {v.vehicle_number}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>{v.geofence_name}</div>
              </div>
              <div style={{ fontSize: "0.7rem", color: "#334155", whiteSpace: "nowrap" }}>
                {v.triggered_at ? formatDistanceToNow(new Date(v.triggered_at), { addSuffix: true }) : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Live Alert Feed */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f1f5f9" }}>Live Alert Feed</h2>
              <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 2 }}>WebSocket real-time events</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "#10b981", opacity: 0.4 }} className="ping-slow" />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} className="live-dot" />
              </div>
              <span style={{ fontSize: "0.7rem", color: "#34d399", fontWeight: 600 }}>Real-time</span>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
            {alertHistory && alertHistory.length > 0 ? (
              alertHistory.slice(0, 15).map((a, i) => <AlertItem key={i} alert={a} />)
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
                <div style={{ color: "#334155", fontSize: "0.875rem", fontWeight: 500 }}>Waiting for live alerts...</div>
                <div style={{ color: "#1e293b", fontSize: "0.75rem", marginTop: 4 }}>Move a vehicle into a geofence to trigger</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
