/**
 * usePotholes - Pothole data management with bounds-based loading
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { potholesAPI } from "../api/client.js";

export const DATA_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error"
};

export function usePotholes() {
  const [potholes, setPotholes] = useState([]);
  const [dataState, setDataState] = useState(DATA_STATE.IDLE);
  const [error, setError] = useState(null);
  const lastBoundsRef = useRef(null);
  const abortControllerRef = useRef(null);

  const loadPotholes = useCallback(async (bounds) => {
    // Debounce rapid bounds changes
    if (lastBoundsRef.current && boundsEqual(lastBoundsRef.current, bounds)) {
      return;
    }

    lastBoundsRef.current = bounds;

    // Cancel pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setDataState(DATA_STATE.LOADING);
    setError(null);

    try {
      const data = await potholesAPI.getByBounds(bounds);
      setPotholes(data);
      setDataState(DATA_STATE.LOADED);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Unable to load road hazard data");
        setDataState(DATA_STATE.ERROR);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (lastBoundsRef.current) {
      await loadPotholes(lastBoundsRef.current);
    }
  }, [loadPotholes]);

  const addPothole = useCallback((pothole) => {
    setPotholes((current) => {
      // Check if already exists (update)
      const existingIndex = current.findIndex(
        (p) => (p.id || p._id) === (pothole.id || pothole._id)
      );

      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = pothole;
        return updated;
      }

      // Add new
      return [pothole, ...current];
    });
  }, []);

  const removePothole = useCallback((id) => {
    setPotholes((current) =>
      current.filter((p) => (p.id || p._id) !== id)
    );
  }, []);

  const updatePothole = useCallback((id, updates) => {
    setPotholes((current) =>
      current.map((p) =>
        (p.id || p._id) === id ? { ...p, ...updates } : p
      )
    );
  }, []);

  const isLoading = dataState === DATA_STATE.LOADING;
  const isLoaded = dataState === DATA_STATE.LOADED;
  const hasError = dataState === DATA_STATE.ERROR;
  const isEmpty = isLoaded && potholes.length === 0;

  return {
    potholes,
    dataState,
    error,
    isLoading,
    isLoaded,
    hasError,
    isEmpty,
    loadPotholes,
    refresh,
    addPothole,
    removePothole,
    updatePothole
  };
}

/**
 * Compare two Leaflet bounds objects
 */
function boundsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.getSouth() === b.getSouth() &&
    a.getWest() === b.getWest() &&
    a.getNorth() === b.getNorth() &&
    a.getEast() === b.getEast()
  );
}
