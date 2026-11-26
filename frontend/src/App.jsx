import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertSocketProvider, useAlertSocket } from "./context/AlertSocketContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Geofences from "./pages/Geofences";
import LiveTracking from "./pages/LiveTracking";
import AlertConfig from "./pages/AlertConfig";
import Violations from "./pages/Violations";
import AlertRules from "./pages/AlertRules";
import VehicleStatus from "./pages/VehicleStatus";
import Login from "./pages/Login";

/** Sends anyone without a session to /login, remembering where they were going. */
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function Shell() {
  const { status, alertHistory } = useAlertSocket();
  const { pathname } = useLocation();
  return (
    <div className="gt-shell">
      <Sidebar status={status} />
      <div className="gt-main">
        <Header status={status} />
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
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AlertSocketProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{
            duration: 4000,
            style: { background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", fontWeight:500, boxShadow:"var(--shadow-md)" },
            success: { iconTheme: { primary:"#16A34A", secondary:"#FFFFFF" } },
            error:   { iconTheme: { primary:"#DC2626", secondary:"#FFFFFF" } },
          }} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </AlertSocketProvider>
    </AuthProvider>
  );
}
