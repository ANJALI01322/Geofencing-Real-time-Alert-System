import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Truck, Hexagon, Radio,
  SlidersHorizontal, AlertOctagon, Wifi, WifiOff, Satellite
} from "lucide-react";

const NAV = [
  { to: "/dashboard",     icon: LayoutDashboard,   label: "Dashboard"    },
  { to: "/vehicles",      icon: Truck,             label: "Fleet"        },
  { to: "/geofences",     icon: Hexagon,           label: "Geofences"    },
  { to: "/live-tracking", icon: Radio,             label: "Live Tracking"},
  { to: "/alert-config",  icon: SlidersHorizontal, label: "Alert Rules"  },
  { to: "/violations",    icon: AlertOctagon,      label: "Violations"   },
];

export default function Sidebar({ connected }) {
  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: "#FFFFFF",
      borderRight: "1px solid #E5E7EB",
      display: "flex", flexDirection: "column",
      position: "relative", zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: "#2563EB",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(37,99,235,0.3)", flexShrink: 0,
          }}>
            <Satellite size={16} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              GeoTrack
            </div>
            <div style={{ fontSize: 9, color: "#2563EB", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Fleet v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "10px 10px", flex: 1, overflowY: "auto" }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 6px 8px" }}>
          Navigation
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 9,
              padding: "9px 10px", borderRadius: 8,
              fontSize: "0.82rem", fontWeight: isActive ? 600 : 500,
              color: isActive ? "#2563EB" : "#6B7280",
              background: isActive ? "#EFF6FF" : "transparent",
              textDecoration: "none",
              transition: "background 0.12s, color 0.12s",
              marginBottom: 1,
            })}
            onMouseEnter={e => { if (!e.currentTarget.style.background.includes("EFF6FF")) e.currentTarget.style.background="#F3F4F6"; }}
            onMouseLeave={e => { if (!e.currentTarget.style.background.includes("EFF6FF")) e.currentTarget.style.background="transparent"; }}>
            {({ isActive }) => <>
              <Icon size={15} strokeWidth={isActive ? 2 : 1.8} color={isActive ? "#2563EB" : "#9CA3AF"}/>
              <span style={{ flex: 1 }}>{label}</span>
            </>}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid #F3F4F6" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 10px", borderRadius: 8,
          background: connected ? "#F0FDF4" : "#FFF1F2",
          border: `1px solid ${connected ? "#BBF7D0" : "#FECDD3"}`,
        }}>
          <span className={connected ? "live-dot-green" : ""} style={!connected ? {
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: "#EF4444", flexShrink: 0,
          } : { flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: connected ? "#16A34A" : "#DC2626", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.2 }}>
              {connected ? "WS LIVE" : "OFFLINE"}
            </div>
            <div style={{ fontSize: "0.6rem", color: "#9CA3AF" }}>
              {connected ? "Real-time active" : "Reconnecting..."}
            </div>
          </div>
          {connected ? <Wifi size={12} color="#16A34A"/> : <WifiOff size={12} color="#DC2626"/>}
        </div>
        <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.6rem", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>MapUp Assessment</span>
          <span style={{ fontSize: "0.6rem", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>v1.0</span>
        </div>
      </div>
    </aside>
  );
}
