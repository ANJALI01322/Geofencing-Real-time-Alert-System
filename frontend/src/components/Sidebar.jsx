import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Truck, MapPin, Radio,
  Bell, AlertTriangle, Settings, Shield, Wifi, WifiOff
} from "lucide-react";

const NAV = [
  { to: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vehicles",      icon: Truck,           label: "Vehicles" },
  { to: "/geofences",     icon: MapPin,          label: "Geofences" },
  { to: "/live-tracking", icon: Radio,           label: "Live Tracking" },
  { to: "/alert-config",  icon: Settings,        label: "Alert Config" },
  { to: "/violations",    icon: AlertTriangle,   label: "Violations" },
];

export default function Sidebar({ connected }) {
  return (
    <aside style={{
      width: 240,
      minWidth: 240,
      background: "linear-gradient(180deg, #0d1117 0%, #0a0f1e 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      padding: "0",
      position: "relative",
      zIndex: 10
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(99,102,241,0.4)"
          }}>
            <Shield size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9", letterSpacing: "-0.02em" }}>GeoTrack</div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Fleet Management</div>
          </div>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)", margin: "16px 0 0" }} />
      </div>

      {/* Nav */}
      <nav style={{ padding: "0 12px", flex: 1 }}>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 4px 8px" }}>
          Navigation
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            style={{ marginBottom: 2 }}>
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div style={{ padding: "16px 20px 24px" }}>
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: connected ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${connected ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
        }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            {connected && (
              <div style={{
                position: "absolute", width: 10, height: 10, borderRadius: "50%",
                background: "#10b981", opacity: 0.4,
              }} className="ping-slow" />
            )}
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: connected ? "#10b981" : "#ef4444",
            }} className={connected ? "live-dot" : ""} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: connected ? "#34d399" : "#f87171" }}>
              {connected ? "WebSocket Live" : "Connecting..."}
            </div>
            <div style={{ fontSize: "0.65rem", color: "#475569" }}>
              {connected ? "Real-time alerts active" : "Retrying connection"}
            </div>
          </div>
          {connected ? <Wifi size={14} color="#34d399" style={{ marginLeft: "auto" }} /> : <WifiOff size={14} color="#f87171" style={{ marginLeft: "auto" }} />}
        </div>
      </div>
    </aside>
  );
}
