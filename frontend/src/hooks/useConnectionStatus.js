/**
 * useConnectionStatus - Track backend and service connectivity
 */

import { useState, useEffect, useCallback } from "react";
import { checkHealth, API_STATUS } from "../api/client.js";

export const CONNECTION_STATE = {
  CONNECTING: "connecting",
  LIVE: "live",
  OFFLINE: "offline",
  ERROR: "error"
};

export function useConnectionStatus(pollIntervalMs = 30000) {
  const [connectionState, setConnectionState] = useState(CONNECTION_STATE.CONNECTING);
  const [databaseStatus, setDatabaseStatus] = useState("unknown");
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);

  const checkConnection = useCallback(async () => {
    setConnectionState(CONNECTION_STATE.CONNECTING);

    try {
      const result = await checkHealth();

      if (result.status === API_STATUS.CONNECTED) {
        setConnectionState(CONNECTION_STATE.LIVE);
        setDatabaseStatus(result.database);
        setError(null);
      } else {
        setConnectionState(CONNECTION_STATE.OFFLINE);
        setDatabaseStatus("disconnected");
        setError(result.error || "Server unavailable");
      }

      setLastChecked(new Date());
    } catch (err) {
      setConnectionState(CONNECTION_STATE.ERROR);
      setDatabaseStatus("disconnected");
      setError(err.message);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (pollIntervalMs > 0) {
      const interval = setInterval(checkConnection, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [checkConnection, pollIntervalMs]);

  const isConnected = connectionState === CONNECTION_STATE.LIVE;
  const isConnecting = connectionState === CONNECTION_STATE.CONNECTING;
  const isOffline = connectionState === CONNECTION_STATE.OFFLINE || connectionState === CONNECTION_STATE.ERROR;

  return {
    connectionState,
    databaseStatus,
    lastChecked,
    error,
    isConnected,
    isConnecting,
    isOffline,
    retry: checkConnection
  };
}
