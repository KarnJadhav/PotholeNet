export function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function routeHazards(route, potholes, radiusMeters = 25) {
  if (!route?.geometry?.coordinates?.length) return [];

  const sampledRoute = route.geometry.coordinates
    .filter((_, index) => index % 8 === 0)
    .map(([lng, lat]) => ({ lat, lng }));

  return potholes.filter((pothole) => {
    const point = { lat: pothole.latitude, lng: pothole.longitude };
    return sampledRoute.some((routePoint) => distanceMeters(routePoint, point) <= radiusMeters);
  });
}

export function analyzeRouteRisk(route, potholes, radiusMeters = 20) {
  const hazards = routeHazards(route, potholes, radiusMeters);
  const routeDistanceKm = Math.max((route?.distance || 0) / 1000, 1);
  const severityScore = hazards.reduce((sum, pothole) => {
    if (Number.isFinite(pothole.riskScore)) return sum + pothole.riskScore / 25;
    if (pothole.severity === "severe") return sum + 3;
    if (pothole.severity === "medium") return sum + 2;
    return sum + 1;
  }, 0);
  const densityScore = severityScore / routeDistanceKm;
  const score = Math.min(100, Math.round(densityScore * 12));

  let level = "Safe";
  if (score >= 70) level = "Dangerous";
  else if (score >= 35) level = "Moderate";

  return {
    hazards,
    level,
    score,
    distanceKm: route?.distance ? route.distance / 1000 : 0,
    durationMin: route?.duration ? route.duration / 60 : 0
  };
}
