import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WEATHER_LOCATION,
  WeatherLocation,
} from "@/feature/widgets/Weather/libs/openMeteo";
import { useI18n } from "@/shared/i18n/client";

const STORAGE_KEY = "lifedashboard.weatherLocation";
let geolocationPromise: Promise<WeatherLocation | null> | null = null;
const CURRENT_LOCATION_LABEL = {
  ko: "현재 위치",
  en: "Current location",
} as const;

type WeatherLocationState = {
  location: WeatherLocation;
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

function requestGeolocation(
  currentLocationLabel: string
): Promise<WeatherLocation | null> {
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
          label: currentLocationLabel,
        });
      },
      () => resolve(null),
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
        hasStoredLocation: false,
      };
    }
    const stored = parseStoredLocation(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      return { location: stored, hasStoredLocation: true };
    }
    return {
      location: defaultLocation,
      hasStoredLocation: false,
    };
  });
  const { location: storedLocation, hasStoredLocation } = state;
  const location = hasStoredLocation ? storedLocation : defaultLocation;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistLocation = (next: WeatherLocation) => {
      setState({ location: next, hasStoredLocation: true });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    if (hasStoredLocation) {
      const isCurrentLocationLabel =
        storedLocation.label === CURRENT_LOCATION_LABEL.ko ||
        storedLocation.label === CURRENT_LOCATION_LABEL.en;
      if (!isCurrentLocationLabel) return;
      void (async () => {
        const label =
          (await resolveLocationLabel({
            ...storedLocation,
            label: currentLocationLabel,
          })) ||
          currentLocationLabel;
        if (label === storedLocation.label) return;
        persistLocation({ ...storedLocation, label });
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
      persistLocation({ ...result, label });
    })();
  }, [
    currentLocationLabel,
    hasStoredLocation,
    resolveLocationLabel,
    storedLocation,
  ]);

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
