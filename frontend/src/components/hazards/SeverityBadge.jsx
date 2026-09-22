/**
 * SeverityBadge - Visual severity indicator
 */

import { getSeverityColor } from "../../utils/severity.js";

export function SeverityBadge({ severity, showLabel = true }) {
  const color = getSeverityColor(severity);

  return (
    <span
      className="severity-badge"
      style={{
        backgroundColor: color,
        color: "white"
      }}
      role="status"
    >
      {showLabel && <span className="severity-label">{severity?.toUpperCase()}</span>}
    </span>
  );
}
