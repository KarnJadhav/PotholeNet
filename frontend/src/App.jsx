import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { io } from "socket.io-client";
import { AlertTriangle, Camera, LocateFixed, MapPin, Navigation, Search, ShieldAlert } from "lucide-react";
import { fetchPotholes, getRoute, reportPothole, searchPlaces, votePothole } from "./api";
import { distanceMeters, routeHazards } from "./geo";

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

function severityColor(severity) {
  if (severity === "severe") return "#ef4444";
  if (severity === "medium") return "#f59e0b";
  return "#22c55e";
}

function getCoords(pothole) {
  return [pothole.latitude, pothole.longitude];
}

export default function App() {
  const [position, setPosition] = useState(null);
  const [potholes, setPotholes] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [watching, setWatching] = useState(false);
  const alertedRef = useRef(new Set());
  const watchIdRef = useRef(null);

  const hazardsOnRoute = useMemo(() => routeHazards(route, potholes), [route, potholes]);
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

  async function submitDetection() {
    if (!position) {
      setStatus("Location is required before saving a pothole");
      return;
    }

    setStatus("Saving detected pothole");

    try {
      await reportPothole({
        latitude: position.lat,
        longitude: position.lng,
        confidence: 0.88,
        severity: "medium",
        source: "camera",
        reportedBy: "demo-user"
      });
      setStatus("Pothole report saved");
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
        </div>

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
            <strong>{hazardsOnRoute.length}</strong>
          </div>
        </section>

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
              pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.75 }}
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
