/**
 * Formatting utilities
 */

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined) return "Not available";
  const pct = Math.round(confidence * 100);
  return `${pct}%`;
}

/**
 * Format depth in centimeters
 */
export function formatDepth(depthCm, method) {
  if (depthCm === null || depthCm === undefined) {
    return { value: "Not available", label: "Depth" };
  }

  const value = `${depthCm.toFixed(1)} cm`;

  if (method) {
    return { value, label: `Estimated depth`, method };
  }

  return { value, label: "Depth" };
}

/**
 * Format area (approximate pothole size)
 */
export function formatArea(area) {
  if (area === null || area === undefined || area === 0) {
    return "Not available";
  }

  if (area < 100) {
    return `${area.toFixed(0)} cm²`;
  }

  return `${(area / 10000).toFixed(2)} m²`;
}

/**
 * Format coordinates
 */
export function formatCoordinates(lat, lng) {
  if (lat === null || lng === null) {
    return "Not available";
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Format distance
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined) {
    return "Not available";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "Not available";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return "Not available";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

/**
 * Format relative time (for detection history)
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
  });
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
