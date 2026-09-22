import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { BarChart3, MapPin } from "lucide-react";
import { Header, ServerUnavailable } from "./components/layout/index.js";
import { SearchBox, MapControls } from "./components/controls/index.js";
import { MapView } from "./components/map/index.js";
import { HazardPanel } from "./components/hazards/index.js";
import { DetectionHistory } from "./components/hazards/DetectionHistory.jsx";
import { RouteRiskCard } from "./components/route/index.js";
import { LiveMetrics } from "./components/dashboard/index.js";

import { useConnectionStatus, CONNECTION_STATE } from "./hooks/useConnectionStatus.js";
import { useSocket, SOCKET_STATE } from "./hooks/useSocket.js";
import { usePotholes } from "./hooks/usePotholes.js";
import { useGeolocation } from "./hooks/useGeolocation.js";

import { potholesAPI, routingAPI } from "./api/client.js";
import { nearestHazard, routeHazards } from "./utils/geo.js";
import { getRiskLevel, getRiskColor } from "./utils/risk.js";

// Legacy API exports re-exported for compatibility
import {
  detectImage as legacyDetectImage,
  fetchDashboard as legacyFetchDashboard,
  fetchPotholes as legacyFetchPotholes,
  getRoute as legacyGetRoute,
  reportPothole as legacyReportPothole,
  searchPlaces as legacySearchPlaces,
  votePothole as legacyVotePothole,
  API_BASE_URL
} from "./api.js";
export { legacyDetectImage, legacyFetchDashboard, legacyFetchPotholes, API_BASE_URL };

export default function App() {
  // Connection
  const connection = useConnectionStatus();
  const socket = useSocket();

  // Data
  const { potholes, dataState, error: potholeError, isLoading, isLoaded, hasError, isEmpty, loadPotholes, addPothole, refresh } = usePotholes();
  const { position, isTracking, getCurrentPosition, startTracking, stopTracking } = useGeolocation();

  // UI state
  const [view, setView] = useState("local");
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  // Refs
  const alertedRef = useRef(new Set());
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const drivingTimerRef = useRef(null);
  const processingFrameRef = useRef(false);
  const lastAutoReportRef = useRef({ at: 0, lat: null, lng: null });

  // Connection is ready
  const isConnected = connection.isConnected && socket.isConnected;

  // Route risk
  const routeRisk = useMemo(() => {
    if (!route) return null;
    const hazards = routeHazards(route, potholes, 20);
    let score = 0;
    if (hazards.length > 0) {
      const severityScore = hazards.reduce((sum, p) => {
        if (Number.isFinite(p.riskScore)) return sum + p.riskScore / 25;
        if (p.severity === "severe") return sum + 3;
        if (p.severity === "medium") return sum + 2;
        return sum + 1;
      }, 0);
      const distanceKm = Math.max((route.distance || 0) / 1000, 1);
      score = Math.min(100, Math.round((severityScore / distanceKm) * 12));
    }
    const level = getRiskLevel(score);
    return { hazards, score, level, distanceKm: route.distance ? route.distance / 1000 : 0 };
  }, [route, potholes]);

  const routeColor = routeRisk ? getRiskColor(routeRisk.level) : "#2563eb";

  // Nearest hazard for warnings
  const nearest = useMemo(() => nearestHazard(potholes, position), [potholes, position]);

  // Live socket updates
  useEffect(() => {
    if (!socket) return;
    const unsub = socket.subscribe("pothole:upserted", (pothole) => {
      addPothole(pothole);
    });
    return unsub;
  }, [socket, addPothole]);

  // Voice + visual warnings
  useEffect(() => {
    if (!nearest || alertedRef.current.has(nearest.pothole.id || nearest.pothole._id)) return;

    const id = nearest.pothole.id || nearest.pothole._id;
    alertedRef.current.add(id);
    const text = `Pothole ahead in ${Math.round(nearest.distance)} meters`;
    setStatus(text);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, [nearest]);

  // Initial location
  useEffect(() => {
    getCurrentPosition().catch(() => setStatus("Location permission is needed for live road alerts"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial load
  useEffect(() => {
    if (connection.isConnected) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.isConnected, refresh]);

  // Dashboard data
  useEffect(() => {
    if (view !== "dashboard") return;
    if (!connection.isConnected) return;

    legacyFetchDashboard()
      .then(setDashboard)
      .catch((err) => setStatus(err.message || "Could not load dashboard"));
  }, [view, connection.isConnected, potholes]);

  // Cleanup driving mode
  useEffect(() => {
    return () => {
      window.clearInterval(drivingTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleBoundsChange = useCallback((bounds) => {
    loadPotholes(bounds);
  }, [loadPotholes]);

  const handleLocate = useCallback(async () => {
    try {
      await getCurrentPosition();
      setStatus("Location updated");
    } catch {
      setStatus("Could not read your location");
    }
  }, [getCurrentPosition]);

  const handleToggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, stopTracking, startTracking]);

  const handleSearchSelect = useCallback((place) => {
    if (!position) {
      setStatus("Set your current location first");
      return;
    }
    setDestination(place);
    setStatus("Calculating route");
    setRoute(null);

    routingAPI.getRoute({ lat: position.lat, lng: position.lng }, { lat: place.lat, lng: place.lng })
      .then((r) => {
        setRoute(r);
        setStatus("Route ready");
      })
      .catch(() => setStatus("Route calculation failed"));
  }, [position]);

  const handleReportPothole = useCallback(async (payload) => {
    try {
      const saved = await legacyReportPothole(payload);
      addPothole(saved);
      return saved;
    } catch (err) {
      throw err;
    }
  }, [addPothole]);

  const handleSelectPothole = useCallback((pothole) => {
    setSelectedPothole(pothole);
  }, []);

  const handlePotholeClick = useCallback((pothole) => {
    setSelectedPothole(pothole);
    setView("detail");
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPothole(null);
    setView("local");
  }, []);

  const handleRetry = useCallback(() => {
    // Force reconnect
    connection.retry();
    setTimeout(() => refresh(), 1000);
  }, [connection, refresh]);

  const disabled = !connection.isConnected && !socket.isConnected;

  // Render the appropriate view content
  const isOffline = connection.isOffline || socket.isDisconnected || socket.hasError;

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <Header connectionState={connection.connectionState} socketState={socket.socketState} />

        <SearchBox onSelectDestination={handleSearchSelect} disabled={!position} />

        <div className="view-tabs" role="tablist" aria-label="View">
          <button type="button" className={view === "local" || view === "detail" ? "active" : ""} onClick={() => setView("local")}>
            <MapPin size={16} />
            Map
          </button>
          <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <BarChart3 size={16} />
            Admin
          </button>
        </div>

        <MapControls
          onLocate={handleLocate}
          onToggleTracking={handleToggleTracking}
          onDetect={() => fileInputRef.current?.click()}
          onToggleDriving={() => {}}
          onToggleHeatmap={() => setHeatmapEnabled((c) => !c)}
          isTracking={isTracking}
          isDriving={false}
          isHeatmapEnabled={heatmapEnabled}
          disabled={disabled}
        />

        {isOffline ? (
          <ServerUnavailable error={connection.error} onRetry={handleRetry} />
        ) : (
          <LiveMetrics potholes={potholes} isConnected={isConnected} />
        )}

        {!isOffline && route && (
          <RouteRiskCard route={route} potholes={potholes} />
        )}

        {!isOffline && nearest && (
          <div className="warning" role="status">
            <AlertTriangle size={20} />
            <div>
              <strong>{Math.round(nearest.distance)} m ahead</strong>
              <span>{nearest.pothole.severity === "severe" ? "SEVERE" : formatSeverity(nearest.pothole.severity)} pothole nearby{nearest.pothole.estimatedDepthCm != null ? ` · ~${nearest.pothole.estimatedDepthCm.toFixed(1)} cm` : ""}</span>
            </div>
          </div>
        )}

        {!isOffline && view === "dashboard" && dashboard && (
          <div className="warning">Dashboard data placeholder</div>
        )}

        <section className="status-panel">
          <span>PotholeNet</span>
          <strong>{status}</strong>
        </section>
      </aside>

      <section className="map-stage">
        <MapView
          position={position}
          destination={destination}
          route={route}
          potholes={potholes}
          heatmapEnabled={heatmapEnabled}
          onBoundsChange={handleBoundsChange}
          onPotholeClick={handlePotholeClick}
          selectedPotholeId={selectedPothole?.id || selectedPothole?._id}
        />

        {selectedPothole && (
          <aside className="float-panel">
            <HazardPanel pothole={selectedPothole} onClose={handleClosePanel} />
            <DetectionHistory potholeId={selectedPothole.id || selectedPothole._id} />
          </aside>
        )}

        {isOffline && (
          <div className="map-overlay">
            <ServerUnavailable error={connection.error} onRetry={handleRetry} />
          </div>
        )}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={handleDetectionFile}
      />
      <video ref={videoRef} className="visually-hidden" muted playsInline />
      <canvas ref={canvasRef} className="visually-hidden" />
    </main>
  );

  function handleDetectionFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !position) return;

    setStatus("Running AI detection");
    legacyDetectImage(file)
      .then((result) => {
        const detection = primaryDetection(result, 0.5);
        if (!detection) {
          setStatus("No pothole detected in image");
          return;
        }
        setStatus("Saving AI pothole report");
        return legacyReportPothole({
          latitude: position.lat,
          longitude: position.lng,
          confidence: detection.confidence,
          severity: detection.severity || "medium",
          area: detection.area || 0,
          estimatedDepthCm: detection.estimatedDepthCm,
          depthMethod: detection.depthMethod,
          source: "camera",
          reportedBy: "demo-user"
        }).then((saved) => {
          addPothole(saved);
          setStatus(`Pothole saved from ${result.model || "AI detection"}`);
        });
      })
      .catch((_err) => setStatus("Detection failed"));
  }
}

function primaryDetection(result, threshold = 0.65) {
  return result?.detections
    ?.filter((item) => item.class === "pothole" && item.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function formatSeverity(severity) {
  return severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : "Unknown";
}