/**
 * HeatmapLayer - Leaflet heat overlay
 */

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export function HeatmapLayer({ potholes, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !potholes?.length) return undefined;

    const heatPoints = potholes.map((pothole) => {
      const intensity = Math.max(0.25, (pothole.riskScore || 35) / 100);
      return [pothole.latitude, pothole.longitude, intensity];
    });

    const layer = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      gradient: {
        0.25: "#22c55e",
        0.55: "#f59e0b",
        0.85: "#ef4444"
      }
    }).addTo(map);

    return () => layer.remove();
  }, [enabled, map, potholes]);

  return null;
}
