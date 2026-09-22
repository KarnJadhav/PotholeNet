/**
 * RouteLayer - Route polyline on map
 */

import { Polyline } from "react-leaflet";
import { getRiskColorFromScore } from "../../utils/risk.js";

export function RouteLayer({ route, riskScore }) {
  if (!route?.geometry?.coordinates) return null;

  const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const color = getRiskColorFromScore(riskScore || 0);

  return (
    <Polyline
      positions={coordinates}
      pathOptions={{ color, weight: 5, opacity: 0.78 }}
    />
  );
}
