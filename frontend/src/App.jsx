import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AlertSocketProvider, useAlertSocket } from "./context/AlertSocketContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Geofences from "./pages/Geofences";
import LiveTracking from "./pages/LiveTracking";
import AlertConfig from "./pages/AlertConfig";
import Violations from "./pages/Violations";
import AlertRules from "./pages/AlertRules";
import VehicleStatus from "./pages/VehicleStatus";

function Shell() {
  const { status, alertHistory } = useAlertSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="gt-shell">
      <Sidebar status={status} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div className={`gt-overlay${mobileOpen ? " show" : ""}`} onClick={() => setMobileOpen(false)} />
      <div className="gt-main">
        <Header status={status} onMenu={() => setMobileOpen(true)} />
        <main className="gt-content">
          <div className="page-enter" key={pathname}>
            <Routes>
              <Route path="/"              element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"     element={<Dashboard alertHistory={alertHistory} />} />
              <Route path="/vehicles"      element={<Vehicles />} />
              <Route path="/geofences"     element={<Geofences />} />
              <Route path="/live-tracking" element={<LiveTracking />} />
              <Route path="/alert-config"  element={<AlertConfig />} />
              <Route path="/violations"    element={<Violations />} />
              <Route path="/alert-rules"   element={<AlertRules />} />
              <Route path="/fleet-status"  element={<VehicleStatus />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AlertSocketProvider>
      <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", fontWeight:500, boxShadow:"var(--shadow-md)" },
        success: { iconTheme: { primary:"#16A34A", secondary:"#FFFFFF" } },
        error:   { iconTheme: { primary:"#DC2626", secondary:"#FFFFFF" } },
      }} />
      <Shell />
    </BrowserRouter>
    </AlertSocketProvider>
  );
}
