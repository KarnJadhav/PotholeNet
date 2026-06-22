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
