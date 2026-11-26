import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Radio, Truck, Hexagon, MoreHorizontal,
  Bell, AlertOctagon, BarChart3, Sun, Moon,
} from "lucide-react";
import { useTheme } from "../theme";

const TABS = [
  { to: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { to: "/live-tracking", icon: Radio,           label: "Live" },
  { to: "/vehicles",      icon: Truck,           label: "Fleet" },
  { to: "/geofences",     icon: Hexagon,         label: "Geofences" },
];

const MORE = [
  { to: "/alert-rules",  icon: Bell,         label: "Alert Rules" },
  { to: "/violations",   icon: AlertOctagon, label: "Violations" },
  { to: "/fleet-status", icon: BarChart3,    label: "Fleet Status" },
];

/** Phone navigation (≤768px): fixed bottom tab bar + a "More" bottom sheet. Hidden on larger screens via CSS. */
export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const moreActive = MORE.some(m => pathname.startsWith(m.to));
  const close = () => setOpen(false);

  return (
    <>
      <nav className="gt-bottomnav" aria-label="Primary">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={close}
            className={({ isActive }) => `gt-tab${isActive && !open ? " active" : ""}`}>
            <Icon size={22} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className={`gt-tab${moreActive || open ? " active" : ""}`}
          onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="gt-more-sheet">
          <MoreHorizontal size={22} strokeWidth={1.9} />
          <span>More</span>
        </button>
      </nav>

      <div className={`gt-more-backdrop${open ? " show" : ""}`} onClick={close} />
      <div id="gt-more-sheet" className={`gt-more-sheet${open ? " show" : ""}`}
        role="dialog" aria-label="More" aria-hidden={!open}>
        <div className="gt-grabber" />
        {MORE.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={close}
            className={({ isActive }) => `gt-more-item${isActive ? " active" : ""}`}>
            <Icon size={20} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
        <div className="gt-more-sep" />
        <button type="button" className="gt-more-item" onClick={toggle}>
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
      </div>
    </>
  );
}
