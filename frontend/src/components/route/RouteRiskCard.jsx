/**
 * RouteRiskCard - Route risk assessment
 */

import { getRiskColor, getRiskLevel } from "../../utils/risk.js";
import { routeHazards } from "../../utils/geo.js";

export function RouteRiskCard({ route, potholes }) {
  if (!route) {
    return (
      <div className="route-empty">
        <span>No active route</span>
        <p>Search for a destination to analyze road risk.</p>
      </div>
    );
  }

  const hazards = routeHazards(route, potholes, 20);
  const score = calculateScore(route, hazards);
  const level = getRiskLevel(score);
  const color = getRiskColor(level);

  const severe = hazards.filter((h) => h.severity === "severe").length;
  const deteriorating = hazards.filter((h) => h.riskScore >= 70).length;

  return (
    <div className={`risk-panel risk-${level.toLowerCase()}`}>
      <div className="risk-header">
        <span>ROUTE RISK</span>
        <strong style={{ color }}>{level}</strong>
      </div>

      <div className="risk-meter" aria-label={`Route risk ${score} percent`}>
        <span style={{ width: `${score}%`, backgroundColor: color }} />
      </div>

      <div className="risk-stats">
        <div>
          <span>{hazards.length}</span>
          <span>hazards</span>
        </div>
        <div>
          <span>{severe}</span>
          <span>severe</span>
        </div>
        <div>
          <span>{deteriorating}</span>
          <span>deteriorating</span>
        </div>
      </div>

      {route.distance && (
        <p>
          {score}% risk across {(route.distance / 1000).toFixed(1)} km
        </p>
      )}
    </div>
  );
}

function calculateScore(route, hazards) {
  if (hazards.length === 0) return 0;

  const severityScore = hazards.reduce((sum, pothole) => {
    if (Number.isFinite(pothole.riskScore)) return sum + pothole.riskScore / 25;
    if (pothole.severity === "severe") return sum + 3;
    if (pothole.severity === "medium") return sum + 2;
    return sum + 1;
  }, 0);

  const distanceKm = Math.max((route.distance || 0) / 1000, 1);
  return Math.min(100, Math.round((severityScore / distanceKm) * 12));
}