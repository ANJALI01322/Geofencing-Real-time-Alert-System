import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Truck, Hexagon, Radio, AlertOctagon, Bell, Satellite,
  PanelLeftClose, PanelLeftOpen, Sun, Moon,
} from "lucide-react";
import { useTheme } from "../theme";

const GROUPS = [
  { label: "Overview", items: [
    { to: "/dashboard",     icon: LayoutDashboard, label: "Dashboard"     },
    { to: "/live-tracking", icon: Radio,           label: "Live Tracking" },
  ]},
  { label: "Manage", items: [
    { to: "/vehicles",      icon: Truck,           label: "Fleet"         },
    { to: "/geofences",     icon: Hexagon,         label: "Geofences"     },
    { to: "/alert-rules",   icon: Bell,            label: "Alert Rules"   },
  ]},
  { label: "Insights", items: [
    { to: "/violations",    icon: AlertOctagon,    label: "Violations"    },
    { to: "/fleet-status",  icon: Truck,           label: "Fleet Status"  },
  ]},
];

const STATUS_PILL = {
  connected:    { label: "WS LIVE",    cls: "" },
  connecting:   { label: "CONNECTING", cls: " warn" },
  disconnected: { label: "OFFLINE",    cls: " off" },
};

export default function Sidebar({ status = "connecting", mobileOpen, onNavigate }) {
  const pill = STATUS_PILL[status] || STATUS_PILL.connecting;
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <aside className={`gt-sb${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      <div className="gt-sb-brand">
        <div className="gt-sb-logo"><Satellite size={16} color="#fff" /></div>
        <span className="gt-sb-title gt-txt">GeoTrack</span>
        <button className="gt-theme-btn gt-txt" onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <nav className="gt-sb-nav">
        {GROUPS.map(g => (
          <div key={g.label}>
            <div className="gt-sb-group">{g.label}</div>
            {g.items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} data-tip={label} onClick={onNavigate}
                className={({ isActive }) => `gt-nav${isActive ? " active" : ""}`}>
                <Icon size={17} strokeWidth={1.9} />
                <span className="gt-txt">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="gt-sb-foot">
        <div className={`gt-pill${pill.cls}`} data-tip={pill.label}>
          <span className="gt-pill-dot" />
          <span className="gt-txt">{pill.label}</span>
        </div>
        <div className="gt-sb-meta">
          <span className="gt-sb-ver">GeoTrack · v2.0</span>
          <button className="gt-collapse-btn" onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
