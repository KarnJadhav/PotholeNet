/**
 * useGeolocation - GPS location tracking
 */

import { useState, useCallback, useRef } from "react";

export const GEO_STATE = {
  IDLE: "idle",
  ACQUIRING: "acquiring",
  TRACKING: "tracking",
  ERROR: "error"
};

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [geoState, setGeoState] = useState(GEO_STATE.IDLE);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = "Geolocation not supported";
        setError(err);
        reject(new Error(err));
        return;
      }

      setGeoState(GEO_STATE.ACQUIRING);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (event) => {
          const pos = {
            lat: event.coords.latitude,
            lng: event.coords.longitude,
            accuracy: event.coords.accuracy,
            timestamp: event.timestamp
          };
          setPosition(pos);
          setGeoState(GEO_STATE.IDLE);
          resolve(pos);
        },
        (err) => {
          const message = err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Unable to get location";
          setError(message);
          setGeoState(GEO_STATE.ERROR);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setGeoState(GEO_STATE.ERROR);
      return;
    }

    if (watchIdRef.current !== null) {
      // Already tracking
      return;
    }

    setGeoState(GEO_STATE.TRACKING);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (event) => {
        setPosition({
          lat: event.coords.latitude,
          lng: event.coords.longitude,
          accuracy: event.coords.accuracy,
          speed: event.coords.speed,
          heading: event.coords.heading,
          timestamp: event.timestamp
        });
      },
      (err) => {
        setError("Location tracking stopped");
        setGeoState(GEO_STATE.ERROR);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGeoState(GEO_STATE.IDLE);
  }, []);

  const isTracking = geoState === GEO_STATE.TRACKING;
  const isAcquiring = geoState === GEO_STATE.ACQUIRING;

  return {
    position,
    geoState,
    error,
    isTracking,
    isAcquiring,
    getCurrentPosition,
    startTracking,
    stopTracking
  };
}
