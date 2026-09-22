/**
 * DestinationMarker - Route destination
 */

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Custom destination icon
const destinationIcon = L.divIcon({
  className: "destination-marker",
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export function DestinationMarker({ destination }) {
  if (!destination) return null;

  return (
    <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
      <Popup>{destination.label}</Popup>
    </Marker>
  );
}
