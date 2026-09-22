/**
 * ConnectionStatus - Real-time connection indicator
 */

import { CONNECTION_STATE } from "../../hooks/useConnectionStatus.js";
import { SOCKET_STATE } from "../../hooks/useSocket.js";

export function ConnectionStatus({ connectionState, socketState }) {
  const isLive = connectionState === CONNECTION_STATE.LIVE && socketState === SOCKET_STATE.CONNECTED;
  const isConnecting = connectionState === CONNECTION_STATE.CONNECTING || socketState === SOCKET_STATE.CONNECTING;
  const isOffline = connectionState === CONNECTION_STATE.OFFLINE ||
                    connectionState === CONNECTION_STATE.ERROR ||
                    socketState === SOCKET_STATE.DISCONNECTED ||
                    socketState === SOCKET_STATE.ERROR;

  let status = "CONNECTING";
  let color = "#64748b";

  if (isLive) {
    status = "LIVE";
    color = "#22c55e";
  } else if (isOffline) {
    status = "OFFLINE";
    color = "#ef4444";
  } else if (isConnecting) {
    status = "CONNECTING";
    color = "#f59e0b";
  }

  return (
    <div className="connection-status" aria-label={`Connection status: ${status}`}>
      <span className="status-dot" style={{ backgroundColor: color }} aria-hidden />
      <span className="status-label">{status}</span>
    </div>
  );
}
