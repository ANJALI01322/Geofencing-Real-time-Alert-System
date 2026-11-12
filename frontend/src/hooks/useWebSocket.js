import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws/alerts";

/**
 * useWebSocket – connects to the GeoTrack alert WebSocket and
 * returns the latest alert event plus connection status.
 *
 * Interview explanation:
 *  - Opens a WebSocket to /ws/alerts on mount
 *  - Parses each incoming JSON message as an AlertEvent
 *  - Reconnects automatically with exponential backoff on disconnect
 *  - Cleans up the connection on unmount
 */
export function useWebSocket() {
  const [lastAlert, setLastAlert]       = useState(null);
  const [connected, setConnected]       = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);

  const wsRef         = useRef(null);
  const retryDelayRef = useRef(1000); // start at 1 s
  const mountedRef    = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        retryDelayRef.current = 1000; // reset backoff on success
        console.log("✅ WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          setLastAlert(alert);
          setAlertHistory((prev) => [alert, ...prev].slice(0, 100)); // keep last 100
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        console.log(`🔌 WebSocket closed. Reconnecting in ${retryDelayRef.current}ms…`);
        // Exponential backoff: 1s → 2s → 4s → … → max 30s
        setTimeout(connect, retryDelayRef.current);
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close(); // triggers onclose → retry
      };
    } catch (e) {
      console.error("WebSocket connection failed:", e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastAlert, connected, alertHistory };
}
