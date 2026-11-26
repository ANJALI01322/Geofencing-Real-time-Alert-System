import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Search, Clock } from "lucide-react";

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

export default function Header({ connected, onMenu }) {
  const { pathname } = useLocation();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="gt-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button className="gt-hamburger" onClick={onMenu} aria-label="Open menu"><Menu size={18} /></button>
        <div className="gt-crumb">
          <span>GeoTrack</span><span style={{ opacity: .5 }}>/</span><b>{TITLES[pathname] || "Dashboard"}</b>
        </div>
      </div>
      <div className="gt-header-right">
        <div className="gt-search">
          <Search size={14} />
          <input type="text" placeholder="Search vehicles, zones…  ⌘K" readOnly />
        </div>
        <span className="gt-clock"><Clock size={12} />{now.toLocaleTimeString("en-GB", { hour12: false })}</span>
        <span className={`gt-live${connected ? "" : " off"}`}><i />{connected ? "LIVE" : "OFFLINE"}</span>
      </div>
    </header>
  );
}
