import { useEffect, useState } from "react";
import { vehicleAPI, violationAPI } from "../api";
import { Truck, User, AlertTriangle, Clock } from "lucide-react";

export default function VehicleStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      vehicleAPI.list().catch(() => null),
      violationAPI.history({ limit: 1000 }).catch(() => null),
    ]).then(([vRes, aRes]) => {
      const v = vRes?.data?.data?.vehicles ?? vRes?.data?.vehicles ?? vRes?.data?.data ?? vRes?.data;
      const a = aRes?.data?.data?.violations ?? aRes?.data?.violations ?? aRes?.data?.data ?? aRes?.data;
      setVehicles(Array.isArray(v) ? v : []);
      setViolations(Array.isArray(a) ? a : []);
    }).finally(() => setLoading(false));
  }, []);

  const cards = vehicles.map(v => {
    const id = v.vehicle_id || v.id;
    const mine = violations.filter(x => x.vehicle_id === id);
    const last = mine.reduce((m, x) => (!m || new Date(x.timestamp) > new Date(m) ? x.timestamp : m), null);
    return { ...v, _id: id, count: mine.length, last };
  }).sort((a, b) => b.count - a.count);

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Truck size={20} color="#2563EB" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: 0 }}>Fleet Status</h1>
          <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: 0, marginTop: 2 }}>Vehicles ranked by violation count</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Loading…</div>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 20px", color: "#9CA3AF", fontSize: "0.85rem" }}>No vehicles registered</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {cards.map(c => (
            <div key={c._id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", borderTop: `3px solid ${c.count > 0 ? "#EF4444" : "#22C55E"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827", fontFamily: "monospace", letterSpacing: "0.03em" }}>{c.vehicle_number}</span>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>{c.vehicle_type || "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#374151", marginBottom: 14 }}>
                <User size={13} color="#9CA3AF" /> {c.driver_name || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={14} color={c.count > 0 ? "#DC2626" : "#16A34A"} />
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: c.count > 0 ? "#DC2626" : "#16A34A", lineHeight: 1 }}>{c.count}</span>
                <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>violation{c.count !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#6B7280" }}>
                <Clock size={12} color="#9CA3AF" />
                {c.last ? new Date(c.last).toLocaleString() : "No violations"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
