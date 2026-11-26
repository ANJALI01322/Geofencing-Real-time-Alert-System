import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, Clock, Sun, Moon } from "lucide-react";
import { useTheme } from "../theme";

const TITLES = {
  "/dashboard": "Dashboard",
  "/vehicles": "Fleet",
  "/geofences": "Geofences",
  "/live-tracking": "Live Tracking",
  "/alert-config": "Alert Config",
  "/alert-rules": "Alert Rules",
  "/violations": "Violations",
  "/fleet-status": "Fleet Status",
};

const LIVE_BADGE = {
  connected:    { label: "LIVE",       cls: "" },
  connecting:   { label: "CONNECTING", cls: " warn" },
  disconnected: { label: "OFFLINE",    cls: " off" },
};

export default function Header({ status = "connecting" }) {
  const badge = LIVE_BADGE[status] || LIVE_BADGE.connecting;
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="gt-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div className="gt-crumb">
          <span className="gt-crumb-root">GeoTrack <span style={{ opacity: .5, marginLeft: 6 }}>/</span></span><b>{TITLES[pathname] || "Dashboard"}</b>
        </div>
      </div>
      <div className="gt-header-right">
        <div className="gt-search">
          <Search size={14} />
          <input type="text" placeholder="Search vehicles, zones…  ⌘K" readOnly />
        </div>
        <span className="gt-clock"><Clock size={12} />{now.toLocaleTimeString("en-GB", { hour12: false })}</span>
        <button className="gt-theme-header" onClick={toggle} aria-label="Toggle dark mode">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <span className={`gt-live${badge.cls}`}><i />{badge.label}</span>
      </div>
    </header>
  );
}
