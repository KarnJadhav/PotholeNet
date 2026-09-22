/**
 * PotholeLayer - Pothole markers on map
 */

import { CircleMarker, Popup } from "react-leaflet";
import { getSeverityColor, getSeverityRadius } from "../../utils/severity.js";

export function PotholeLayer({ potholes, onPotholeClick, selectedId }) {
  if (!potholes || potholes.length === 0) return null;

  return (
    <>
      {potholes.map((pothole) => {
        const id = pothole.id || pothole._id;
        const lat = pothole.latitude;
        const lng = pothole.longitude;
        const severity = pothole.severity || "medium";
        const isSelected = id === selectedId;

        if (lat === undefined || lng === undefined) return null;

        return (
          <CircleMarker
            key={id}
            center={[lat, lng]}
            radius={isSelected ? getSeverityRadius(severity) + 3 : getSeverityRadius(severity)}
            pathOptions={{
              color: getSeverityColor(severity),
              fillColor: getSeverityColor(severity),
              fillOpacity: isSelected ? 1 : 0.75,
              weight: isSelected ? 3 : 1
            }}
            eventHandlers={{
              click: () => onPotholeClick?.(pothole)
            }}
          >
            <Popup>
              <div className="popup">
                <strong>{severity} pothole</strong>
                <span>{Math.round((pothole.confidence || 0.8) * 100)}% confidence</span>
                <span>{pothole.reports?.length || 1} report(s)</span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
