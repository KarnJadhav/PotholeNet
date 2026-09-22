/**
 * DetectionHistory - Detection event timeline
 */

import { useState, useEffect } from "react";
import { potholesAPI } from "../../api/client.js";
import { formatRelativeDate } from "../../utils/formatting.js";

export function DetectionHistory({ potholeId }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!potholeId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    potholesAPI.getHistory(potholeId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [potholeId]);

  if (loading) {
    return <div className="history-loading">Loading detection history...</div>;
  }

  if (error) {
    return <div className="history-error">Unable to load detection history.</div>;
  }

  if (!history || history.length === 0) {
    return <div className="history-empty">No historical detections available.</div>;
  }

  // Analyze trend
  const trend = analyzeTrend(history);

  return (
    <div className="detection-history">
      <div className="history-header">
        <span>DETECTION HISTORY</span>
        {trend && history.length > 1 && (
          <span className={`trend trend-${trend.toLowerCase()}`}>{trend}</span>
        )}
      </div>

      <ul className="history-timeline">
        {history.map((event, index) => (
          <li key={event._id || index} className={`history-item ${index === 0 ? "latest" : ""}`}>
            <div className="history-date">{formatRelativeDate(event.createdAt)}</div>
            <div className="history-severity">{event.severity}</div>
            <div className="history-detail">
              {event.estimatedDepthCm != null && `~${event.estimatedDepthCm.toFixed(1)} cm`}
              {event.confidence != null && ` · ${Math.round(event.confidence * 100)}% conf`}
            </div>
          </li>
        ))}
      </ul>

      <div className="history-summary">
        <span>{history.length} detection(s)</span>
        {history.length === 1 && <span> · Insufficient data</span>}
      </div>
    </div>
  );
}

/**
 * Determine deterioration trend from history
 */
function analyzeTrend(history) {
  if (history.length < 2) return null;

  const severityWeight = { minor: 1, medium: 2, severe: 3 };
  const first = history[history.length - 1];
  const last = history[0];

  const firstWeight = severityWeight[first?.severity] || 2;
  const lastWeight = severityWeight[last?.severity] || 2;

  if (lastWeight > firstWeight) return "Deteriorating";
  if (lastWeight < firstWeight) return "Improving";
  return "Stable";
}