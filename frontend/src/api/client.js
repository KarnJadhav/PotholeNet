/**
 * API Client - Centralized fetch wrapper with error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || "http://localhost:8000";
const OSRM_BASE_URL = "https://router.project-osrm.org";

export const API_STATUS = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error"
};

class APIError extends Error {
  constructor(message, statusCode, endpoint) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Safe fetch wrapper with timeout and error handling
 */
async function safeFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.message || `Request failed with status ${response.status}`,
        response.status,
        url
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new APIError("Request timed out", 408, url);
    }

    if (error instanceof APIError) {
      throw error;
    }

    // Network error (server unavailable, CORS, etc.)
    throw new APIError(
      "Unable to connect to server",
      0,
      url
    );
  }
}

/**
 * Check backend health
 */
export async function checkHealth() {
  try {
    const response = await safeFetch(`${API_BASE_URL}/health`, {}, 5000);
    const data = await response.json();
    return {
      status: API_STATUS.CONNECTED,
      database: data.database,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: API_STATUS.DISCONNECTED,
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Potholes API
 */
export const potholesAPI = {
  async getByBounds(bounds) {
    const params = new URLSearchParams();

    if (bounds) {
      params.set("minLat", bounds.getSouth());
      params.set("minLng", bounds.getWest());
      params.set("maxLat", bounds.getNorth());
      params.set("maxLng", bounds.getEast());
    }

    const response = await safeFetch(`${API_BASE_URL}/api/potholes?${params}`);
    return response.json();
  },

  async getNearby(latitude, longitude, radius = 100) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(radius)
    });

    const response = await safeFetch(`${API_BASE_URL}/api/potholes/nearby?${params}`);
    return response.json();
  },

  async getById(id) {
    const response = await safeFetch(`${API_BASE_URL}/api/potholes/${id}`);
    return response.json();
  },

  async getHistory(id) {
    const response = await safeFetch(`${API_BASE_URL}/api/potholes/${id}/history`);
    return response.json();
  },

  async create(payload) {
    const response = await safeFetch(`${API_BASE_URL}/api/potholes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.json();
  },

  async vote(id, vote) {
    const response = await safeFetch(`${API_BASE_URL}/api/potholes/${id}/vote`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote })
    });
    return response.json();
  },

  async getDashboard() {
    const response = await safeFetch(`${API_BASE_URL}/api/potholes/dashboard`);
    return response.json();
  }
};

/**
 * Segments API
 */
export const segmentsAPI = {
  async getByBounds(bounds) {
    const params = new URLSearchParams();

    if (bounds) {
      params.set("minLat", bounds.getSouth());
      params.set("minLng", bounds.getWest());
      params.set("maxLat", bounds.getNorth());
      params.set("maxLng", bounds.getEast());
    }

    const response = await safeFetch(`${API_BASE_URL}/api/segments?${params}`);
    return response.json();
  },

  async getById(id) {
    const response = await safeFetch(`${API_BASE_URL}/api/segments/${id}`);
    return response.json();
  }
};

/**
 * Detection API (ML Service)
 */
export const detectionAPI = {
  async detectImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await safeFetch(`${ML_SERVICE_URL}/detect`, {
      method: "POST",
      body: formData
    }, 30000); // 30s timeout for ML processing

    return response.json();
  }
};

/**
 * Geocoding API (Nominatim)
 */
export const geocodingAPI = {
  async search(query) {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "5"
    });

    const response = await safeFetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "Accept-Language": "en" } }
    );

    return response.json();
  }
};

/**
 * Routing API (OSRM)
 */
export const routingAPI = {
  async getRoute(start, destination) {
    const coordinates = `${start.lng},${start.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      steps: "true"
    });

    const response = await safeFetch(`${OSRM_BASE_URL}/route/v1/driving/${coordinates}?${params}`);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new APIError("No route found", 404, "routing");
    }

    return data.routes[0];
  }
};

export { API_BASE_URL, ML_SERVICE_URL };
