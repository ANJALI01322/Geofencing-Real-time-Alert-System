import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Truck, Hexagon, Radio, AlertOctagon, Bell, Satellite,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

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

export default function Sidebar({ connected, mobileOpen, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`gt-sb${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      <div className="gt-sb-brand">
        <div className="gt-sb-logo"><Satellite size={16} color="#fff" /></div>
        <span className="gt-sb-title gt-txt">GeoTrack</span>
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
        <div className={`gt-pill${connected ? "" : " off"}`} data-tip={connected ? "WS LIVE" : "OFFLINE"}>
          <span className="gt-pill-dot" />
          <span className="gt-txt">{connected ? "WS LIVE" : "OFFLINE"}</span>
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
