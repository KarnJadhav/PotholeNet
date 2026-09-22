/**
 * DrivingMode - Continuous camera-based detection during driving
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { Video } from "lucide-react";
import { detectionAPI } from "../../api/client.js";
import { distanceMeters } from "../../utils/geo.js";
import { formatDate } from "../../utils/formatting.js";

export function DrivingMode({ position, onReport, isTracking, startTracking, stopTracking }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const processingRef = useRef(false);
  const lastReportRef = useRef({ at: 0, lat: null, lng: null });

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [gpsConnected, setGpsConnected] = useState(false);

  useEffect(() => {
    return () => stopDriving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGpsConnected(Boolean(position));
  }, [position]);

  const stopDriving = useCallback((updateState = true) => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    processingRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraConnected(false);
    if (updateState) setIsActive(false);
  }, []);

  const captureFrame = useCallback(async () => {
    if (processingRef.current || !position || !videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState < 2) return;

    const last = lastReportRef.current;
    const movedEnough =
      last.lat === null ||
      distanceMeters({ lat: position.lat, lng: position.lng }, { lat: last.lat, lng: last.lng }) > 8;

    if (!movedEnough && Date.now() - last.at < 15000) return;

    processingRef.current = true;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
      if (!blob) return;

      const file = new File([blob], `driving-frame-${Date.now()}.jpg`, { type: "image/jpeg" });
      const result = await detectionAPI.detectImage(file);
      const detection = primaryDetection(result);

      if (!detection) {
        setStatus("scanning");
        return;
      }

      setLastDetection({
        severity: detection.severity || "medium",
        confidence: detection.confidence,
        area: detection.area || 0,
        estimatedDepthCm: detection.estimatedDepthCm,
        depthMethod: detection.depthMethod,
        time: Date.now()
      });

      await onReport({
        latitude: position.lat,
        longitude: position.lng,
        confidence: detection.confidence,
        severity: detection.severity || "medium",
        area: detection.area || 0,
        estimatedDepthCm: detection.estimatedDepthCm,
        depthMethod: detection.depthMethod,
        source: "driving_mode",
        reportedBy: "driving-mode"
      });

      lastReportRef.current = { at: Date.now(), lat: position.lat, lng: position.lng };
      setStatus("detected");
    } catch (err) {
      setError("Detection failed");
    } finally {
      processingRef.current = false;
    }
  }, [position, onReport]);

  const start = useCallback(async () => {
    if (!position) {
      setError("Location is required before driving mode");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraConnected(true);
      setError(null);

      if (!isTracking) startTracking();
      setIsActive(true);
      setStatus("active");
      timerRef.current = window.setInterval(captureFrame, 2000);
      setLastDetection(null);
    } catch (_err) {
      setError("Camera permission is needed for driving mode");
    }
  }, [position, isTracking, startTracking, captureFrame]);

  const toggle = useCallback(() => {
    if (isActive) {
      stopDriving();
      setStatus("idle");
    } else {
      start();
    }
  }, [isActive, start, stopDriving]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className={`danger ${isActive ? "active" : ""}`}
        aria-label={isActive ? "Stop driving mode" : "Start driving mode"}
        aria-pressed={isActive}
      >
        <Video size={18} />
        Drive
      </button>

      <video ref={videoRef} className={isActive ? "camera-preview" : "visually-hidden"} muted playsInline />
      <canvas ref={canvasRef} className="visually-hidden" />

      {isActive && (
        <div className="driving-status">
          <div className="driving-header">
            <span className="driving-dot" />
            DRIVING MODE
          </div>
          <div className="driving-row">
            <span>Camera</span>
            <span className={cameraConnected ? "ok" : "off"}>
              {cameraConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="driving-row">
            <span>GPS</span>
            <span className={gpsConnected ? "ok" : "off"}>
              {gpsConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {lastDetection && (
            <div className="detection-result">
              <span>Pothole detected</span>
              <div className="detection-detail">
                <span>Severity: {lastDetection.severity}</span>
                <span>Confidence: {Math.round(lastDetection.confidence * 100)}%</span>
                {lastDetection.estimatedDepthCm != null ? (
                  <span>Depth: Estimated {lastDetection.estimatedDepthCm.toFixed(1)} cm</span>
                ) : (
                  <span>Depth: Not available</span>
                )}
                <span>Location saved</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="driving-error">{error}</div>}
    </>
  );
}

function primaryDetection(result, threshold = 0.65) {
  return result?.detections
    ?.filter((item) => item.class === "pothole" && item.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)[0];
}