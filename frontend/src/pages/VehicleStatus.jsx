import { useCallback, useEffect, useState } from "react";
import { vehicleAPI, violationAPI } from "../api";
import { Truck, User, AlertTriangle, Clock } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";

export default function VehicleStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      vehicleAPI.list().catch(() => null),
      violationAPI.history({ limit: 1000 }).catch(() => null),
    ]).then(([vRes, aRes]) => {
      if (!vRes) { setError(true); return; }
      const v = vRes?.data?.data?.vehicles ?? vRes?.data?.vehicles ?? vRes?.data?.data ?? vRes?.data;
      const a = aRes?.data?.data?.violations ?? aRes?.data?.violations ?? aRes?.data?.data ?? aRes?.data;
      setVehicles(Array.isArray(v) ? v : []);
      setViolations(Array.isArray(a) ? a : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = vehicles.map(v => {
    const id = v.vehicle_id || v.id;
    const mine = violations.filter(x => x.vehicle_id === id);
    const last = mine.reduce((m, x) => (!m || new Date(x.timestamp) > new Date(m) ? x.timestamp : m), null);
    return { ...v, _id: id, count: mine.length, last };
  }).sort((a, b) => b.count - a.count);

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "var(--bg-subtle)", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 3, background: "linear-gradient(90deg,#3B82F6,#22C55E)", margin: "-28px -32px 25px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Truck size={20} color="#2563EB" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>Fleet Status</h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Vehicles ranked by violation count</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 150 }} />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : cards.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles registered" text="Add vehicles in Fleet to see their violation status here." />
      ) : (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {cards.map(c => (
            <div key={c._id} className="gt-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", fontFamily: "var(--font-mono)", letterSpacing: "0.01em" }}>{c.vehicle_number}</span>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>{c.vehicle_type || "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--text-2)", marginBottom: 14 }}>
                <User size={13} color="#9CA3AF" /> {c.driver_name || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={14} color={c.count > 0 ? "#DC2626" : "#16A34A"} />
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: c.count > 0 ? "#DC2626" : "#16A34A", lineHeight: 1 }}>{c.count}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>violation{c.count !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--text-muted)" }}>
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
