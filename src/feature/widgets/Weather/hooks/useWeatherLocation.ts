import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WEATHER_LOCATION,
  WeatherLocation,
} from "@/feature/widgets/Weather/libs/openMeteo";
import { useI18n } from "@/shared/i18n/client";

const STORAGE_KEY = "lifedashboard.weatherLocation";
const SOURCE_STORAGE_KEY = "lifedashboard.weatherLocationSource";
let geolocationPromise: Promise<WeatherLocation | null> | null = null;
const CURRENT_LOCATION_LABEL = {
  ko: "현재 위치",
  en: "Current location",
} as const;

export type WeatherLocationSource = "current" | "preset" | "search";

type WeatherLocationState = {
  location: WeatherLocation;
  source: WeatherLocationSource;
  hasStoredLocation: boolean;
};

function getDefaultLocationLabel(language: "ko" | "en") {
  return language === "ko" ? "서울" : "Seoul";
}

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

function parseStoredLocationSource(
  value: string | null
): WeatherLocationSource | null {
  if (value === "current" || value === "preset" || value === "search") {
    return value;
  }
  return null;
}

function inferStoredLocationSource(
  location: WeatherLocation
): WeatherLocationSource {
  if (
    location.label === CURRENT_LOCATION_LABEL.ko ||
    location.label === CURRENT_LOCATION_LABEL.en
  ) {
    return "current";
  }
  return "search";
}

function buildCoordinateLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function requestGeolocation(
  currentLocationLabel: string,
  options: { force?: boolean } = {}
): Promise<WeatherLocation | null> {
  if (!options.force && geolocationPromise) return geolocationPromise;
  geolocationPromise = new Promise((resolve) => {
    if (!navigator.geolocation) {
      geolocationPromise = null;
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        geolocationPromise = null;
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: currentLocationLabel,
        });
      },
      () => {
        geolocationPromise = null;
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
  return geolocationPromise;
}

export function useWeatherLocation() {
  const { language } = useI18n();
  const currentLocationLabel =
    language === "ko"
      ? CURRENT_LOCATION_LABEL.ko
      : CURRENT_LOCATION_LABEL.en;
  const defaultLocation = useMemo<WeatherLocation>(
    () => ({
      ...DEFAULT_WEATHER_LOCATION,
      label: getDefaultLocationLabel(language),
    }),
    [language]
  );

  const [state, setState] = useState<WeatherLocationState>(() => {
    if (typeof window === "undefined") {
      return {
        location: defaultLocation,
        source: "preset",
        hasStoredLocation: false,
      };
    }
    const stored = parseStoredLocation(localStorage.getItem(STORAGE_KEY));
    const storedSource = parseStoredLocationSource(
      localStorage.getItem(SOURCE_STORAGE_KEY)
    );
    if (stored) {
      return {
        location: stored,
        source: storedSource ?? inferStoredLocationSource(stored),
        hasStoredLocation: true,
      };
    }
    return {
      location: defaultLocation,
      source: "preset",
      hasStoredLocation: false,
    };
  });
  const { location: storedLocation, source: locationSource, hasStoredLocation } =
    state;
  const location = hasStoredLocation ? storedLocation : defaultLocation;

  const persistLocation = useCallback(
    (next: WeatherLocation, source: WeatherLocationSource) => {
      setState({ location: next, source, hasStoredLocation: true });
      if (typeof window === "undefined") return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(SOURCE_STORAGE_KEY, source);
    },
    []
  );

  const resolveLocationLabel = useCallback(
    async (baseLocation: WeatherLocation) => {
      const params = new URLSearchParams({
        lat: String(baseLocation.latitude),
        lon: String(baseLocation.longitude),
        language,
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
    [language]
  );

  const setLocationByCoordinates = useCallback(
    async (
      params: { latitude: number; longitude: number; label?: string },
      source: WeatherLocationSource = "search"
    ) => {
      const label = params.label?.trim();
      const fallbackLabel = buildCoordinateLabel(params.latitude, params.longitude);
      const baseLocation: WeatherLocation = {
        latitude: params.latitude,
        longitude: params.longitude,
        label: label || fallbackLabel,
      };
      const resolvedLabel = label || (await resolveLocationLabel(baseLocation));
      persistLocation({
        ...baseLocation,
        label: resolvedLabel || fallbackLabel,
      }, source);
    },
    [persistLocation, resolveLocationLabel]
  );

  const refreshCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return false;
    }
    const result = await requestGeolocation(currentLocationLabel, { force: true });
    if (!result) return false;
    const label = (await resolveLocationLabel(result)) || currentLocationLabel;
    persistLocation({ ...result, label }, "current");
    return true;
  }, [currentLocationLabel, persistLocation, resolveLocationLabel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (hasStoredLocation) {
      if (locationSource !== "current") return;
      void (async () => {
        const label =
          (await resolveLocationLabel({
            ...storedLocation,
            label: currentLocationLabel,
          })) ||
          currentLocationLabel;
        if (label === storedLocation.label) return;
        persistLocation({ ...storedLocation, label }, "current");
      })();
      return;
    }

    void (async () => {
      if (!navigator.geolocation || !("permissions" in navigator)) return;
      const status = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      if (status.state !== "granted") return;
      const result = await requestGeolocation(currentLocationLabel);
      if (!result) return;
      const label = await resolveLocationLabel(result);
      persistLocation({ ...result, label }, "current");
    })();
  }, [
    currentLocationLabel,
    hasStoredLocation,
    locationSource,
    persistLocation,
    resolveLocationLabel,
    storedLocation,
  ]);

  const saveLocation = useCallback(
    (next: WeatherLocation, source: WeatherLocationSource = "search") => {
      persistLocation(next, source);
    },
    [persistLocation]
  );

  return {
    location,
    locationSource,
    setLocation: saveLocation,
    setLocationByCoordinates,
    refreshCurrentLocation,
  };
}
