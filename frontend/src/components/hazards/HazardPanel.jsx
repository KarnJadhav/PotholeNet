/**
 * HazardPanel - Pothole intelligence detail panel
 */

import { X, AlertTriangle } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge.jsx";
import { HazardStatusBadge } from "./HazardStatusBadge.jsx";
import { formatConfidence, formatDepth, formatArea, formatCoordinates, formatDate } from "../../utils/formatting.js";
import { formatSeverity } from "../../utils/severity.js";

export function HazardPanel({ pothole, onClose }) {
  if (!pothole) return null;

  const lat = pothole.latitude;
  const lng = pothole.longitude;
  const depth = formatDepth(pothole.estimatedDepthCm, pothole.depthMethod);
  const area = formatArea(pothole.area);

  return (
    <div className="hazard-panel" role="dialog" aria-label="Hazard details">
      <div className="panel-header">
        <div className="panel-title">
          <SeverityBadge severity={pothole.severity} />
          <span>POTHOLE</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="panel-close"
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="panel-body">
        <div className="detail-grid">
          <DetailItem
            label="Severity"
            value={formatSeverity(pothole.severity)}
            color={pothole.severity === "severe" ? "#ef4444" : pothole.severity === "medium" ? "#f59e0b" : "#22c55e"}
          />

          <DetailItem
            label="Estimated depth"
            value={depth.value}
            subtitle={depth.method ? `Method: ${depth.method}` : undefined}
          />

          <DetailItem label="Size" value={area} />

          <DetailItem label="Confidence" value={formatConfidence(pothole.confidence)} />

          <DetailItem
            label="Status"
            value={pothole.status ? formatSeverity(pothole.status) : "Active"}
            badge={<HazardStatusBadge status={pothole.status} />}
          />

          <DetailItem
            label="Risk score"
            value={pothole.riskScore != null ? `${pothole.riskScore}%` : "Not available"}
          />
        </div>

        <div className="detail-section">
          <span className="section-label">Location</span>
          <div className="detail-row">
            <span>Road</span>
            <span>{pothole.roadName || "Unknown road"}</span>
          </div>
          {pothole.roadType && (
            <div className="detail-row">
              <span>Road type</span>
              <span>{pothole.roadType}</span>
            </div>
          )}
          <div className="detail-row">
            <span>Coordinates</span>
            <span>{formatCoordinates(lat, lng)}</span>
          </div>
        </div>

        <div className="detail-section">
          <span className="section-label">Reports</span>
          <div className="detail-row">
            <span>Total reports</span>
            <span>{pothole.reports?.length || 1}</span>
          </div>
          <div className="detail-row">
            <span>First reported</span>
            <span>{formatDate(pothole.createdAt)}</span>
          </div>
          <div className="detail-row">
            <span>Last updated</span>
            <span>{formatDate(pothole.updatedAt)}</span>
          </div>
        </div>

        <div className="detail-section">
          <span className="section-label">Votes</span>
          <div className="vote-summary">
            <span>Still exists: {pothole.votes?.stillExists || 0}</span>
            <span>Fixed: {pothole.votes?.fixed || 0}</span>
            <span>Dangerous: {pothole.votes?.dangerous || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, subtitle, color, badge }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <div className="detail-value" style={color ? { color } : undefined}>
        {badge || value}
      </div>
      {subtitle && <span className="detail-subtitle">{subtitle}</span>}
    </div>
  );
}
