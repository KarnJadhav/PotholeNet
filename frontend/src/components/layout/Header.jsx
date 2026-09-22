/**
 * Header - Brand and connection status
 */

import { ShieldAlert } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus.jsx";
import { CONNECTION_STATE } from "../../hooks/useConnectionStatus.js";
import { SOCKET_STATE } from "../../hooks/useSocket.js";

export function Header({ connectionState, socketState }) {
  return (
    <div className="brand">
      <ShieldAlert aria-hidden />
      <div>
        <h1>PotholeNet</h1>
        <p>Live road hazard intelligence</p>
      </div>
      <ConnectionStatus connectionState={connectionState} socketState={socketState} />
    </div>
  );
}
