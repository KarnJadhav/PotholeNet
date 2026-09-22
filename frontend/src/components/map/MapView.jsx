/**
 * MapView - Main Leaflet map component
 */

import { useEffect, useCallback, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { UserLocationMarker } from "./UserLocationMarker.jsx";
import { PotholeLayer } from "./PotholeLayer.jsx";
import { RouteLayer } from "./RouteLayer.jsx";
import { HeatmapLayer } from "./HeatmapLayer.jsx";
import { DestinationMarker } from "./DestinationMarker.jsx";

const DEFAULT_CENTER = [18.5204, 73.8567];
const DEFAULT_ZOOM = 13;

function MapEvents({ onBoundsChange }) {
  const map = useMap();

  useEffect(() => {
    const update = () => onBoundsChange(map.getBounds());
    update();
    map.on("moveend", update);
    return () => map.off("moveend", update);
  }, [map, onBoundsChange]);

  return null;
}

export function MapView({
  position,
  destination,
  route,
  potholes,
  heatmapEnabled,
  onBoundsChange,
  onPotholeClick,
  selectedPotholeId
}) {
  const mapKey = useRef(0);
  const center = position ? [position.lat, position.lng] : DEFAULT_CENTER;

  return (
    <MapContainer
      key={mapKey.current}
      center={center}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="map-container"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapEvents onBoundsChange={onBoundsChange} />

      <UserLocationMarker position={position} />

      <DestinationMarker destination={destination} />

      <RouteLayer route={route} />

      <PotholeLayer
        potholes={potholes}
        onPotholeClick={onPotholeClick}
        selectedId={selectedPotholeId}
      />

      <HeatmapLayer potholes={potholes} enabled={heatmapEnabled} />
    </MapContainer>
  );
}
