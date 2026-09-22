/**
 * Severity utilities
 */

export const SEVERITY = {
  MINOR: "minor",
  MEDIUM: "medium",
  SEVERE: "severe"
};

export const SEVERITY_LABELS = {
  [SEVERITY.MINOR]: "Minor",
  [SEVERITY.MEDIUM]: "Medium",
  [SEVERITY.SEVERE]: "Severe"
};

export const SEVERITY_COLORS = {
  [SEVERITY.MINOR]: "#22c55e",
  [SEVERITY.MEDIUM]: "#f59e0b",
  [SEVERITY.SEVERE]: "#ef4444"
};

export const SEVERITY_SIZE = {
  [SEVERITY.MINOR]: 7,
  [SEVERITY.MEDIUM]: 9,
  [SEVERITY.SEVERE]: 12
};

/**
 * Get severity color for display
 */
export function getSeverityColor(severity) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS[SEVERITY.MEDIUM];
}

/**
 * Get marker radius based on severity
 */
export function getSeverityRadius(severity) {
  return SEVERITY_SIZE[severity] || SEVERITY_SIZE[SEVERITY.MEDIUM];
}

/**
 * Format severity for display
 */
export function formatSeverity(severity) {
  return SEVERITY_LABELS[severity] || "Unknown";
}

/**
 * Get severity from numeric weight
 */
export function severityFromWeight(weight) {
  if (weight >= 2.5) return SEVERITY.SEVERE;
  if (weight >= 1.5) return SEVERITY.MEDIUM;
  return SEVERITY.MINOR;
}
