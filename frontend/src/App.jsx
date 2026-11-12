import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useWebSocket } from "./hooks/useWebSocket";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Geofences from "./pages/Geofences";
import LiveTracking from "./pages/LiveTracking";
import AlertConfig from "./pages/AlertConfig";
import Violations from "./pages/Violations";

export default function App() {
  const { lastAlert, connected, alertHistory } = useWebSocket();
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background:"#FFFFFF", color:"#111827", border:"1px solid #E5E7EB", borderRadius:"10px", fontSize:"0.875rem", fontWeight:500, boxShadow:"0 4px 12px rgba(0,0,0,0.08)" },
        success: { iconTheme: { primary:"#16A34A", secondary:"#FFFFFF" } },
        error:   { iconTheme: { primary:"#DC2626", secondary:"#FFFFFF" } },
      }} />
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"#F8FAFC" }}>
        <Sidebar connected={connected} />
        <main style={{ flex:1, overflowY:"auto" }}>
          <Routes>
            <Route path="/"              element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"     element={<Dashboard alertHistory={alertHistory} />} />
            <Route path="/vehicles"      element={<Vehicles />} />
            <Route path="/geofences"     element={<Geofences />} />
            <Route path="/live-tracking" element={<LiveTracking lastAlert={lastAlert} connected={connected} />} />
            <Route path="/alert-config"  element={<AlertConfig />} />
            <Route path="/violations"    element={<Violations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
