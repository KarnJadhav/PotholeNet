/**
 * CameraDetection - Single-image pothole detection
 */

import { useRef, useCallback, useState } from "react";
import { Camera } from "lucide-react";
import { detectionAPI } from "../../api/client.js";

export function CameraDetection({ position, onReport }) {
  const fileInputRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [error, setError] = useState(null);

  const openPicker = useCallback(() => {
    if (!position) {
      setError("Location is required before saving a pothole");
      return;
    }
    setError(null);
    fileInputRef.current?.click();
  }, [position]);

  const handleFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !position) return;

    setIsDetecting(true);
    setDetectionResult(null);
    setError(null);

    try {
      const result = await detectionAPI.detectImage(file);
      const detection = primaryDetection(result, 0.5);

      if (!detection) {
        setError("No pothole detected in image");
        return;
      }

      setDetectionResult({
        severity: detection.severity || "medium",
        confidence: detection.confidence,
        area: detection.area || 0,
        estimatedDepthCm: detection.estimatedDepthCm,
        depthMethod: detection.depthMethod,
        source: result.model || "camera"
      });

      // Trigger report callback
      await onReport({
        latitude: position.lat,
        longitude: position.lng,
        confidence: detection.confidence,
        severity: detection.severity || "medium",
        area: detection.area || 0,
        estimatedDepthCm: detection.estimatedDepthCm,
        depthMethod: detection.depthMethod,
        source: "camera",
        reportedBy: "demo-user"
      });
    } catch (err) {
      setError("Unable to run detection right now");
    } finally {
      setIsDetecting(false);
    }
  }, [position, onReport]);

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={isDetecting || !position}
        aria-label="Detect pothole from camera"
      >
        {isDetecting ? <span className="spinner" /> : <Camera size={18} />}
        {isDetecting ? "Detecting..." : "Detect"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={handleFile}
      />

      {detectionResult && (
        <div className="detection-result">
          <span>Detection complete — 1 pothole detected</span>
          <div className="detection-detail">
            <span>Severity: {detectionResult.severity}</span>
            <span>Confidence: {Math.round(detectionResult.confidence * 100)}%</span>
            {detectionResult.estimatedDepthCm != null ? (
              <span>
                Depth: {detectionResult.estimatedDepthCm.toFixed(1)} cm
                {detectionResult.depthMethod ? ` (${detectionResult.depthMethod})` : " (estimated)"}
              </span>
            ) : (
              <span>Depth: Not available</span>
            )}
          </div>
        </div>
      )}

      {error && <div className="detection-error">{error}</div>}
    </>
  );
}

function primaryDetection(result, threshold = 0.65) {
  return result?.detections
    ?.filter((item) => item.class === "pothole" && item.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)[0];
}