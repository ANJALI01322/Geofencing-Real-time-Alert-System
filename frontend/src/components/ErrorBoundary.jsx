import { Component } from "react";

/** Catches render errors anywhere below it and shows a friendly fallback. */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", color: "var(--text)", padding: 24,
      }}>
        <div style={{
          maxWidth: 420, textAlign: "center", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-md)", padding: "40px 32px",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
            background: "#FEF2F2", color: "var(--danger)", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700,
          }}>!</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>
            GeoTrack hit an unexpected error. Reloading usually fixes it. If it keeps happening, please try again in a minute.
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: "10px 20px", borderRadius: "var(--r-md)", border: "none",
            background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
