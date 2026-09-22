/**
 * useSocket - Socket.IO connection management
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../api/client.js";

export const SOCKET_STATE = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error"
};

export function useSocket() {
  const [socketState, setSocketState] = useState(SOCKET_STATE.CONNECTING);
  const [socketError, setSocketError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketState(SOCKET_STATE.CONNECTED);
      setSocketError(null);
    });

    socket.on("disconnect", (reason) => {
      setSocketState(SOCKET_STATE.DISCONNECTED);
      if (reason === "io server disconnect") {
        // Server disconnected us, try to reconnect
        socket.connect();
      }
    });

    socket.on("connect_error", (error) => {
      setSocketState(SOCKET_STATE.ERROR);
      setSocketError(error.message || "Connection failed");
    });

    socket.on("reconnecting", (attemptNumber) => {
      setSocketState(SOCKET_STATE.CONNECTING);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((eventName, callback) => {
    if (socketRef.current) {
      socketRef.current.on(eventName, callback);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off(eventName, callback);
      }
    };
  }, []);

  const emit = useCallback((eventName, data) => {
    if (socketRef.current) {
      socketRef.current.emit(eventName, data);
    }
  }, []);

  return {
    socketState,
    socketError,
    isConnected: socketState === SOCKET_STATE.CONNECTED,
    isConnecting: socketState === SOCKET_STATE.CONNECTING,
    isDisconnected: socketState === SOCKET_STATE.DISCONNECTED,
    hasError: socketState === SOCKET_STATE.ERROR,
    subscribe,
    emit
  };
}
