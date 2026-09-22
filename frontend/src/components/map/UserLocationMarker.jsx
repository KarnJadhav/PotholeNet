/**
 * UserLocationMarker - Current GPS position
 */

import { CircleMarker, Popup } from "react-leaflet";

export function UserLocationMarker({ position }) {
  if (!position) return null;

  return (
    <CircleMarker
      center={[position.lat, position.lng]}
      radius={9}
      pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.8 }}
    >
      <Popup>Your current location</Popup>
    </CircleMarker>
  );
}
