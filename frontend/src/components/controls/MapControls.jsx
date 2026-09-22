/**
 * MapControls - Locate, Track, Detect, Drive, Heat buttons
 */

import { Camera, Flame, LocateFixed, Navigation, Video } from "lucide-react";

export function MapControls({
  onLocate,
  onToggleTracking,
  onDetect,
  onToggleDriving,
  onToggleHeatmap,
  isTracking,
  isDriving,
  isHeatmapEnabled,
  disabled
}) {
  return (
    <div className="control-grid">
      <button
        type="button"
        onClick={onLocate}
        disabled={disabled}
        aria-label="Get current location"
      >
        <LocateFixed size={18} />
        Locate
      </button>

      <button
        type="button"
        onClick={onToggleTracking}
        className={isTracking ? "active" : ""}
        disabled={disabled}
        aria-label={isTracking ? "Stop tracking" : "Start tracking"}
        aria-pressed={isTracking}
      >
        <Navigation size={18} />
        Track
      </button>

      <button
        type="button"
        onClick={onDetect}
        disabled={disabled}
        aria-label="Detect pothole from camera"
      >
        <Camera size={18} />
        Detect
      </button>

      <button
        type="button"
        onClick={onToggleDriving}
        className={`danger ${isDriving ? "active" : ""}`}
        disabled={disabled}
        aria-label={isDriving ? "Stop driving mode" : "Start driving mode"}
        aria-pressed={isDriving}
      >
        <Video size={18} />
        Drive
      </button>

      <button
        type="button"
        onClick={onToggleHeatmap}
        className={`heat ${isHeatmapEnabled ? "active" : ""}`}
        aria-label={isHeatmapEnabled ? "Disable heatmap" : "Enable heatmap"}
        aria-pressed={isHeatmapEnabled}
      >
        <Flame size={18} />
        Heat
      </button>
    </div>
  );
}
