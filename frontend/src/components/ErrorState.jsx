import { AlertTriangle, RefreshCw } from "lucide-react";

/** Inline error state with a retry button — used when a page's data fails to load. */
export default function ErrorState({ title = "Couldn't load data", message = "The server didn't respond. It may be waking up — please try again.", onRetry }) {
  return (
    <div className="gt-empty">
      <div className="gt-empty-icon" style={{ background: "#FEF2F2", color: "var(--danger)" }}>
        <AlertTriangle size={24} strokeWidth={1.8} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{
          marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
