import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Truck, Hexagon, Radio,
  SlidersHorizontal, AlertOctagon, Wifi, WifiOff, Satellite
} from "lucide-react";

const NAV = [
  { to: "/dashboard",     icon: LayoutDashboard,    label: "Dashboard",     shortcut: "D" },
  { to: "/vehicles",      icon: Truck,              label: "Fleet",         shortcut: "F" },
  { to: "/geofences",     icon: Hexagon,            label: "Geofences",     shortcut: "G" },
  { to: "/live-tracking", icon: Radio,              label: "Live Tracking", shortcut: "L" },
  { to: "/alert-config",  icon: SlidersHorizontal,  label: "Alert Rules",   shortcut: "A" },
  { to: "/violations",    icon: AlertOctagon,       label: "Violations",    shortcut: "V" },
];

export default function Sidebar({ connected }) {
  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: "var(--bg-base)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: "var(--blue)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(14,165,233,0.4)",
            flexShrink: 0,
          }}>
            <Satellite size={16} color="#fff" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}>GeoTrack</div>
            <div style={{
              fontSize: 9,
              color: "var(--blue)",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>Fleet · v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav section */}
      <div style={{ padding: "12px 10px", flex: 1 }}>
        <div style={{
          fontSize: "0.6rem",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          padding: "0 6px 8px",
        }}>
          Navigation
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid var(--border)" }}>
        {/* WebSocket status */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 6,
          background: connected ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
          border: `1px solid ${connected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
        }}>
          <div className="dot-wrap" style={{ width: 8, height: 8, flexShrink: 0 }}>
            {connected && (
              <div className="live-ring" style={{ background: "var(--green)" }} />
            )}
            <div style={{
              width: 8, height: 8,
              borderRadius: "50%",
              background: connected ? "var(--green)" : "var(--red)",
              position: "relative", zIndex: 1,
            }} className={connected ? "blink" : ""} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: connected ? "var(--green)" : "var(--red)",
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.2,
            }}>
              {connected ? "WS LIVE" : "OFFLINE"}
            </div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
              {connected ? "Real-time active" : "Reconnecting…"}
            </div>
          </div>
          {connected
            ? <Wifi size={12} color="var(--green)" />
            : <WifiOff size={12} color="var(--red)" />}
        </div>

        {/* System tag */}
        <div style={{
          marginTop: 8,
          padding: "5px 10px",
          borderRadius: 5,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>
            SYS
          </span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-3)", fontFamily: "JetBrains Mono" }}>
            {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </aside>
  );
}
