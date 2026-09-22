/**
 * Risk level utilities
 */

export const RISK_LEVEL = {
  SAFE: "Safe",
  MODERATE: "Moderate",
  DANGEROUS: "Dangerous"
};

export const RISK_COLORS = {
  [RISK_LEVEL.SAFE]: "#2563eb",
  [RISK_LEVEL.MODERATE]: "#f59e0b",
  [RISK_LEVEL.DANGEROUS]: "#ef4444"
};

export const RISK_THRESHOLDS = {
  MODERATE: 35,
  DANGEROUS: 70
};

/**
 * Get risk level from numeric score
 */
export function getRiskLevel(score) {
  if (score >= RISK_THRESHOLDS.DANGEROUS) return RISK_LEVEL.DANGEROUS;
  if (score >= RISK_THRESHOLDS.MODERATE) return RISK_LEVEL.MODERATE;
  return RISK_LEVEL.SAFE;
}

/**
 * Get color for risk level
 */
export function getRiskColor(level) {
  return RISK_COLORS[level] || RISK_COLORS[RISK_LEVEL.SAFE];
}

/**
 * Get color from numeric risk score
 */
export function getRiskColorFromScore(score) {
  return getRiskColor(getRiskLevel(score));
}

/**
 * Calculate risk from pothole data
 */
export function calculateRiskScore(severity, reports = []) {
  const severityWeight = { minor: 1, medium: 2, severe: 3 };
  const severityComponent = (severityWeight[severity] || 2) / 3 * 50;
  const reportComponent = Math.min(reports.length, 10) / 10 * 30;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentReports = reports.filter((r) => {
    const createdAt = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
    return createdAt >= oneWeekAgo;
  }).length;
  const recentComponent = Math.min(recentReports, 5) / 5 * 20;

  return Math.round(severityComponent + reportComponent + recentComponent);
}
