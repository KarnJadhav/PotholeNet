import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.heat";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  BarChart3,
  Camera,
  Flame,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  ShieldAlert,
  Video
} from "lucide-react";
import {
  detectImage,
  fetchDashboard,
  fetchPotholes,
  getRoute,
  reportPothole,
  searchPlaces,
  votePothole
} from "./api";
import { analyzeRouteRisk, distanceMeters } from "./geo";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const defaultCenter = [18.5204, 73.8567];

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

function HeatmapLayer({ potholes, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !potholes.length) return undefined;

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

function severityColor(severity) {
  if (severity === "severe") return "#ef4444";
  if (severity === "medium") return "#f59e0b";
  return "#22c55e";
}

function getCoords(pothole) {
  return [pothole.latitude, pothole.longitude];
}

function primaryDetection(result, threshold = 0.65) {
  return result.detections
    ?.filter((item) => item.class === "pothole" && item.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

export default function App() {
  const [position, setPosition] = useState(null);
  const [potholes, setPotholes] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [view, setView] = useState("map");
  const [status, setStatus] = useState("Ready");
  const [watching, setWatching] = useState(false);
  const [drivingMode, setDrivingMode] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const alertedRef = useRef(new Set());
  const watchIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const drivingTimerRef = useRef(null);
  const processingFrameRef = useRef(false);
  const lastAutoReportRef = useRef({ at: 0, lat: null, lng: null });

  const routeRisk = useMemo(() => analyzeRouteRisk(route, potholes), [route, potholes]);
  const routeColor = routeRisk.level === "Dangerous" ? "#ef4444" : routeRisk.level === "Moderate" ? "#f59e0b" : "#2563eb";
  const nearestHazard = useMemo(() => {
    if (!position) return null;

    return potholes
      .map((pothole) => ({
        pothole,
        distance: distanceMeters(
          { lat: position.lat, lng: position.lng },
          { lat: pothole.latitude, lng: pothole.longitude }
        )
      }))
      .filter((item) => item.distance <= 120)
      .sort((a, b) => a.distance - b.distance)[0];
  }, [position, potholes]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (event) => setPosition({ lat: event.coords.latitude, lng: event.coords.longitude }),
      () => setStatus("Location permission is needed for live road alerts"),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (view !== "dashboard") return;

    fetchDashboard()
      .then(setDashboard)
      .catch((error) => setStatus(error.message));
  }, [view, potholes]);

  useEffect(() => {
    return () => stopDrivingMode(false);
  }, []);

  useEffect(() => {
    const socket = io(API_BASE_URL);
    socket.on("pothole:upserted", (pothole) => {
      setPotholes((current) => {
        const rest = current.filter((item) => item.id !== pothole.id && item._id !== pothole._id);
        return [pothole, ...rest];
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!nearestHazard || alertedRef.current.has(nearestHazard.pothole.id)) return;

    alertedRef.current.add(nearestHazard.pothole.id);
    const text = `Pothole ahead in ${Math.round(nearestHazard.distance)} meters`;
    setStatus(text);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, [nearestHazard]);

  function loadPotholes(bounds) {
    fetchPotholes(bounds)
      .then(setPotholes)
      .catch((error) => setStatus(error.message));
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (event) => {
        const next = { lat: event.coords.latitude, lng: event.coords.longitude };
        setPosition(next);
        setStatus("Location updated");
      },
      () => setStatus("Could not read your location"),
      { enableHighAccuracy: true }
    );
  }

  function toggleTracking() {
    if (watching) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
      return;
    }

    setWatching(true);
    watchIdRef.current = navigator.geolocation?.watchPosition(
      (event) => setPosition({ lat: event.coords.latitude, lng: event.coords.longitude }),
      () => setStatus("Live tracking stopped because location was unavailable"),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  }

  async function startDrivingMode() {
    if (!position) {
      setStatus("Location is required before driving mode");
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

      if (!watching) toggleTracking();
      setDrivingMode(true);
      setStatus("Automatic driving mode started");
      drivingTimerRef.current = window.setInterval(captureDrivingFrame, 2000);
    } catch (_error) {
      setStatus("Camera permission is needed for driving mode");
    }
  }

  function stopDrivingMode(updateState = true) {
    window.clearInterval(drivingTimerRef.current);
    drivingTimerRef.current = null;
    processingFrameRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (updateState) setDrivingMode(false);
  }

  function toggleDrivingMode() {
    if (drivingMode) {
      stopDrivingMode();
      setStatus("Automatic driving mode stopped");
      return;
    }

    startDrivingMode();
  }

  async function captureDrivingFrame() {
    if (processingFrameRef.current || !position || !videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState < 2) return;

    const last = lastAutoReportRef.current;
    const movedEnough =
      last.lat === null ||
      distanceMeters({ lat: position.lat, lng: position.lng }, { lat: last.lat, lng: last.lng }) > 8;

    if (!movedEnough && Date.now() - last.at < 15000) return;

    processingFrameRef.current = true;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
      if (!blob) return;

      const file = new File([blob], `driving-frame-${Date.now()}.jpg`, { type: "image/jpeg" });
      const result = await detectImage(file);
      const detection = primaryDetection(result);

      if (!detection) {
        setStatus("Driving mode scanning");
        return;
      }

      await reportPothole({
        latitude: position.lat,
        longitude: position.lng,
        confidence: detection.confidence,
        severity: detection.severity || "medium",
        area: detection.area || 0,
        source: "driving_mode",
        reportedBy: "driving-mode"
      });

      lastAutoReportRef.current = { at: Date.now(), lat: position.lat, lng: position.lng };
      setStatus(`Auto reported ${detection.severity || "medium"} pothole`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      processingFrameRef.current = false;
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;

    setStatus("Searching places");
    try {
      setResults(await searchPlaces(query));
      setStatus("Select a destination");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function selectDestination(place) {
    if (!position) {
      setStatus("Set your current location first");
      return;
    }

    const nextDestination = {
      lat: Number(place.lat),
      lng: Number(place.lon),
      label: place.display_name
    };

    setDestination(nextDestination);
    setResults([]);
    setStatus("Calculating route");

    try {
      setRoute(await getRoute(position, nextDestination));
      setStatus("Route ready");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function submitDetection() {
    if (!position) {
      setStatus("Location is required before saving a pothole");
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleDetectionFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !position) return;

    setStatus("Running AI detection");

    try {
      const result = await detectImage(file);
      const detection = primaryDetection(result, 0.5);

      if (!detection) {
        setStatus("No pothole detected in image");
        return;
      }

      setStatus("Saving AI pothole report");
      await reportPothole({
        latitude: position.lat,
        longitude: position.lng,
        confidence: detection.confidence,
        severity: detection.severity || "medium",
        area: detection.area || 0,
        source: "camera",
        reportedBy: "demo-user"
      });
      setStatus(`Pothole saved from ${result.model}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleVote(id, vote) {
    try {
      const updated = await votePothole(id, vote);
      setPotholes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div className="brand">
          <ShieldAlert aria-hidden />
          <div>
            <h1>PotholeNet</h1>
            <p>Live road hazard intelligence</p>
          </div>
        </div>

        <form className="search-row" onSubmit={handleSearch}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destination"
            aria-label="Search destination"
          />
          <button type="submit" aria-label="Search">
            <Search size={18} />
          </button>
        </form>

        {results.length > 0 && (
          <div className="result-list">
            {results.map((place) => (
              <button key={`${place.place_id}`} type="button" onClick={() => selectDestination(place)}>
                <MapPin size={16} />
                <span>{place.display_name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="view-tabs" role="tablist" aria-label="View">
          <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            <MapPin size={16} />
            Map
          </button>
          <button
            type="button"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
            <BarChart3 size={16} />
            Admin
          </button>
        </div>

        <div className="control-grid">
          <button type="button" onClick={locateMe}>
            <LocateFixed size={18} />
            Locate
          </button>
          <button type="button" onClick={toggleTracking} className={watching ? "active" : ""}>
            <Navigation size={18} />
            Track
          </button>
          <button type="button" onClick={submitDetection}>
            <Camera size={18} />
            Detect
          </button>
          <button type="button" onClick={toggleDrivingMode} className={drivingMode ? "active danger" : ""}>
            <Video size={18} />
            Drive
          </button>
          <button type="button" onClick={() => setHeatmapEnabled((current) => !current)} className={heatmapEnabled ? "active heat" : ""}>
            <Flame size={18} />
            Heat
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={handleDetectionFile}
          />
        </div>

        <video ref={videoRef} className={drivingMode ? "camera-preview" : "visually-hidden"} muted playsInline />
        <canvas ref={canvasRef} className="visually-hidden" />

        <section className="status-panel">
          <span>Status</span>
          <strong>{status}</strong>
        </section>

        <section className="metric-grid">
          <div>
            <span>Known hazards</span>
            <strong>{potholes.length}</strong>
          </div>
          <div>
            <span>On route</span>
            <strong>{routeRisk.hazards.length}</strong>
          </div>
        </section>

        {route && (
          <section className={`risk-panel risk-${routeRisk.level.toLowerCase()}`}>
            <div>
              <span>Route risk</span>
              <strong>{routeRisk.level}</strong>
            </div>
            <div className="risk-meter" aria-label={`Route risk ${routeRisk.score} percent`}>
              <span style={{ width: `${routeRisk.score}%` }} />
            </div>
            <p>
              {routeRisk.score}% risk across {routeRisk.distanceKm.toFixed(1)} km with{" "}
              {routeRisk.hazards.length} hazard(s)
            </p>
          </section>
        )}

        {view === "dashboard" && dashboard && (
          <section className="dashboard-panel">
            <div className="dashboard-grid">
              <div>
                <span>Active</span>
                <strong>{dashboard.totals.activeHazards}</strong>
              </div>
              <div>
                <span>Today</span>
                <strong>{dashboard.totals.newReportsToday}</strong>
              </div>
              <div>
                <span>Severe</span>
                <strong>{dashboard.totals.severeHazards}</strong>
              </div>
              <div>
                <span>Repair</span>
                <strong>{dashboard.totals.repairQueue}</strong>
              </div>
            </div>
            <div className="repair-table">
              {dashboard.repairQueue.slice(0, 6).map((item) => (
                <div key={item.id} className="repair-row">
                  <div>
                    <strong>{item.roadName}</strong>
                    <span>{item.potholes} report(s) · {item.severity}</span>
                  </div>
                  <b>{item.riskScore}%</b>
                </div>
              ))}
            </div>
          </section>
        )}

        {nearestHazard && (
          <section className="warning">
            <AlertTriangle size={20} />
            <div>
              <strong>{Math.round(nearestHazard.distance)} m ahead</strong>
              <span>{nearestHazard.pothole.severity} pothole nearby</span>
            </div>
          </section>
        )}
      </aside>

      <section className="map-stage">
        <MapContainer center={position ? [position.lat, position.lng] : defaultCenter} zoom={13} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onBoundsChange={loadPotholes} />
          <HeatmapLayer potholes={potholes} enabled={heatmapEnabled} />

          {position && (
            <CircleMarker center={[position.lat, position.lng]} radius={9} pathOptions={{ color: "#2563eb" }}>
              <Popup>Your current location</Popup>
            </CircleMarker>
          )}

          {destination && (
            <Marker position={[destination.lat, destination.lng]}>
              <Popup>{destination.label}</Popup>
            </Marker>
          )}

          {route && (
            <Polyline
              positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{ color: routeColor, weight: 5, opacity: 0.78 }}
            />
          )}

          {potholes.map((pothole) => (
            <CircleMarker
              key={pothole.id || pothole._id}
              center={getCoords(pothole)}
              radius={pothole.severity === "severe" ? 11 : 8}
              pathOptions={{
                color: severityColor(pothole.severity),
                fillColor: severityColor(pothole.severity),
                fillOpacity: 0.75
              }}
            >
              <Popup>
                <div className="popup">
                  <strong>{pothole.severity} pothole</strong>
                  <span>{Math.round(pothole.confidence * 100)}% confidence</span>
                  <span>{pothole.reports?.length || 1} report(s)</span>
                  <div>
                    <button type="button" onClick={() => handleVote(pothole.id || pothole._id, "stillExists")}>
                      Still exists
                    </button>
                    <button type="button" onClick={() => handleVote(pothole.id || pothole._id, "fixed")}>
                      Fixed
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </section>
    </main>
  );
}
