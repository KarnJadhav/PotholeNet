const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || "http://localhost:8000";
const OSRM_BASE_URL = "https://router.project-osrm.org";

export async function fetchPotholes(bounds) {
  const params = new URLSearchParams();

  if (bounds) {
    params.set("minLat", bounds.getSouth());
    params.set("minLng", bounds.getWest());
    params.set("maxLat", bounds.getNorth());
    params.set("maxLng", bounds.getEast());
  }

  const response = await fetch(`${API_BASE_URL}/api/potholes?${params}`);
  if (!response.ok) throw new Error("Could not load potholes");
  return response.json();
}

export async function fetchDashboard() {
  const response = await fetch(`${API_BASE_URL}/api/potholes/dashboard`);
  if (!response.ok) throw new Error("Could not load dashboard");
  return response.json();
}

export async function reportPothole(payload) {
  const response = await fetch(`${API_BASE_URL}/api/potholes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Could not save pothole report");
  return response.json();
}

export async function votePothole(id, vote) {
  const response = await fetch(`${API_BASE_URL}/api/potholes/${id}/vote`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote })
  });

  if (!response.ok) throw new Error("Could not submit vote");
  return response.json();
}

export async function detectImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${ML_SERVICE_URL}/detect`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) throw new Error("ML detection failed");
  return response.json();
}

export async function searchPlaces(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "Accept-Language": "en" }
  });
  if (!response.ok) throw new Error("Place search failed");
  return response.json();
}

export async function getRoute(start, destination) {
  const coordinates = `${start.lng},${start.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true"
  });

  const response = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordinates}?${params}`);
  if (!response.ok) throw new Error("Route calculation failed");

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");

  return route;
}
