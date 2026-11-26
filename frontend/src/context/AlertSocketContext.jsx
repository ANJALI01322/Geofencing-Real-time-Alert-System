import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Resolve the WebSocket URL:
 *   1. VITE_WS_URL, if set
 *   2. VITE_API_URL with http(s) swapped for ws(s)
 *   3. ws://localhost:8080 (local dev)
 */
function resolveWsUrl() {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;
  const api = import.meta.env.VITE_API_URL;
  if (api) return api.replace(/^http/, "ws").replace(/\/$/, "") + "/ws/alerts";
  return "ws://localhost:8080/ws/alerts";
}

const WS_URL = resolveWsUrl();
const MAX_DELAY_MS = 15000;
const HISTORY_LIMIT = 100;

const AlertSocketContext = createContext(null);

/**
 * AlertSocketProvider owns the app's single WebSocket connection.
 *
 * - status: "connecting" | "connected" | "disconnected"
 * - reconnects automatically with exponential backoff: 1s, 2s, 4s, 8s, then 15s max
 * - lastAlert / alertHistory: the most recent events pushed by the server
 */
export function AlertSocketProvider({ children }) {
  const [status, setStatus] = useState("connecting");
  const [lastAlert, setLastAlert] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);

  useEffect(() => {
    let disposed = false;
    let ws = null;
    let timer = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (disposed) return;
        attempt = 0; // reset backoff after a successful connection
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          setLastAlert(alert);
          setAlertHistory((prev) => [alert, ...prev].slice(0, HISTORY_LIMIT));
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setStatus("disconnected");
        const delay = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close(); // triggers onclose -> retry
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ status, connected: status === "connected", lastAlert, alertHistory }),
    [status, lastAlert, alertHistory]
  );

  return <AlertSocketContext.Provider value={value}>{children}</AlertSocketContext.Provider>;
}

/** Read the shared socket state. Must be used inside <AlertSocketProvider>. */
export function useAlertSocket() {
  const ctx = useContext(AlertSocketContext);
  if (!ctx) throw new Error("useAlertSocket must be used inside <AlertSocketProvider>");
  return ctx;
}
