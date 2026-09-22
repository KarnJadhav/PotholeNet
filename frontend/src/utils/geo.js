/**
 * Geo utilities
 */

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

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

/**
 * Extract potholes within radius of a route
 */
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

/**
 * Get nearest hazard within radius
 */
export function nearestHazard(potholes, position, maxDistance = 120) {
  if (!position || !potholes?.length) return null;

  const matches = potholes
    .map((pothole) => ({
      pothole,
      distance: distanceMeters(
        { lat: position.lat, lng: position.lng },
        { lat: pothole.latitude, lng: pothole.longitude }
      )
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  return matches[0] || null;
}