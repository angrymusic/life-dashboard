import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WEATHER_LOCATION,
  WeatherLocation,
} from "@/feature/widgets/Weather/libs/openMeteo";

const STORAGE_KEY = "lifedashboard.weatherLocation";
let geolocationPromise: Promise<WeatherLocation | null> | null = null;
const CURRENT_LOCATION_LABEL = "현재 위치";

type WeatherLocationState = {
  location: WeatherLocation;
  hasStoredLocation: boolean;
};

function parseStoredLocation(value: string | null): WeatherLocation | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<WeatherLocation>;
    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }
    const label =
      typeof parsed.label === "string"
        ? parsed.label
        : DEFAULT_WEATHER_LOCATION.label;
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      label,
    };
  } catch {
    return null;
  }
}

function requestGeolocation(): Promise<WeatherLocation | null> {
  if (geolocationPromise) return geolocationPromise;
  geolocationPromise = new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: CURRENT_LOCATION_LABEL,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
  return geolocationPromise;
}

export function useWeatherLocation() {
  const [state, setState] = useState<WeatherLocationState>(() => {
    if (typeof window === "undefined") {
      return {
        location: DEFAULT_WEATHER_LOCATION,
        hasStoredLocation: false,
      };
    }
    const stored = parseStoredLocation(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      return { location: stored, hasStoredLocation: true };
    }
    return {
      location: DEFAULT_WEATHER_LOCATION,
      hasStoredLocation: false,
    };
  });
  const { location, hasStoredLocation } = state;

  const resolveLocationLabel = useCallback(
    async (baseLocation: WeatherLocation) => {
      const params = new URLSearchParams({
        lat: String(baseLocation.latitude),
        lon: String(baseLocation.longitude),
        language: "ko",
      });
      const url = `/api/geocode/reverse?${params.toString()}`;
      try {
        const response = await fetch(url);
        if (!response.ok) return baseLocation.label;
        const payload = (await response.json()) as { label?: string | null };
        if (payload.label && payload.label.trim()) {
          return payload.label;
        }
        return baseLocation.label;
      } catch {
        return baseLocation.label;
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistLocation = (next: WeatherLocation) => {
      setState({ location: next, hasStoredLocation: true });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    if (hasStoredLocation) {
      if (location.label !== CURRENT_LOCATION_LABEL) return;
      void (async () => {
        const label = await resolveLocationLabel(location);
        if (label === location.label) return;
        persistLocation({ ...location, label });
      })();
      return;
    }

    void (async () => {
      if (!navigator.geolocation || !("permissions" in navigator)) return;
      const status = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      if (status.state !== "granted") return;
      const result = await requestGeolocation();
      if (!result) return;
      const label = await resolveLocationLabel(result);
      persistLocation({ ...result, label });
    })();
  }, [hasStoredLocation, location, resolveLocationLabel]);

  const saveLocation = useCallback((next: WeatherLocation) => {
    setState({ location: next, hasStoredLocation: true });
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return {
    location,
    setLocation: saveLocation,
  };
}
