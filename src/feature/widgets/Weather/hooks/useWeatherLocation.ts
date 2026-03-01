import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WEATHER_LOCATION,
  WeatherLocation,
} from "@/feature/widgets/Weather/libs/openMeteo";
import { useI18n } from "@/shared/i18n/client";

const STORAGE_KEY = "lifedashboard.weatherLocation";
const SOURCE_STORAGE_KEY = "lifedashboard.weatherLocationSource";
const LOCATION_SYNC_EVENT = "lifedashboard:weather-location-changed";
let geolocationPromise: Promise<WeatherLocation | null> | null = null;
const REVERSE_GEOCODE_CACHE_TTL_MS = 5 * 60 * 1000;
const reverseGeocodePromiseByKey = new Map<string, Promise<string | null>>();
const reverseGeocodeLabelCacheByKey = new Map<
  string,
  { label: string; expiresAt: number }
>();
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

function buildReverseGeocodeKey(
  latitude: number,
  longitude: number,
  language: string
) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}:${language}`;
}

function getCachedReverseGeocodeLabel(key: string) {
  const cached = reverseGeocodeLabelCacheByKey.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    reverseGeocodeLabelCacheByKey.delete(key);
    return null;
  }
  return cached.label;
}

function parseStoredLocationState(): {
  location: WeatherLocation;
  source: WeatherLocationSource;
} | null {
  if (typeof window === "undefined") return null;
  const storedLocation = parseStoredLocation(localStorage.getItem(STORAGE_KEY));
  if (!storedLocation) return null;
  const storedSource = parseStoredLocationSource(
    localStorage.getItem(SOURCE_STORAGE_KEY)
  );
  return {
    location: storedLocation,
    source: storedSource ?? inferStoredLocationSource(storedLocation),
  };
}

function isWeatherLocationSyncDetail(
  value: unknown
): value is { location: WeatherLocation; source: WeatherLocationSource } {
  if (!value || typeof value !== "object") return false;
  const detail = value as {
    location?: Partial<WeatherLocation>;
    source?: WeatherLocationSource;
  };
  if (
    detail.source !== "current" &&
    detail.source !== "preset" &&
    detail.source !== "search"
  ) {
    return false;
  }
  if (!detail.location) return false;
  return (
    typeof detail.location.latitude === "number" &&
    typeof detail.location.longitude === "number" &&
    typeof detail.location.label === "string"
  );
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
    const storedState = parseStoredLocationState();
    if (storedState) {
      return {
        location: storedState.location,
        source: storedState.source,
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
      window.dispatchEvent(
        new CustomEvent(LOCATION_SYNC_EVENT, {
          detail: { location: next, source },
        })
      );
    },
    []
  );

  const resolveLocationLabel = useCallback(
    async (baseLocation: WeatherLocation) => {
      const cacheKey = buildReverseGeocodeKey(
        baseLocation.latitude,
        baseLocation.longitude,
        language
      );
      const cachedLabel = getCachedReverseGeocodeLabel(cacheKey);
      if (cachedLabel) return cachedLabel;

      const inFlight = reverseGeocodePromiseByKey.get(cacheKey);
      if (inFlight) {
        const label = await inFlight;
        return label || baseLocation.label;
      }

      const params = new URLSearchParams({
        lat: String(baseLocation.latitude),
        lon: String(baseLocation.longitude),
        language,
      });
      const url = `/api/geocode/reverse?${params.toString()}`;
      const request = (async () => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const payload = (await response.json()) as { label?: string | null };
          const nextLabel = payload.label?.trim();
          if (!nextLabel) return null;
          reverseGeocodeLabelCacheByKey.set(cacheKey, {
            label: nextLabel,
            expiresAt: Date.now() + REVERSE_GEOCODE_CACHE_TTL_MS,
          });
          return nextLabel;
        } catch {
          return null;
        } finally {
          reverseGeocodePromiseByKey.delete(cacheKey);
        }
      })();
      reverseGeocodePromiseByKey.set(cacheKey, request);

      const label = await request;
      return label || baseLocation.label;
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

    const syncFromStorage = () => {
      const storedState = parseStoredLocationState();
      if (!storedState) return;
      setState({
        location: storedState.location,
        source: storedState.source,
        hasStoredLocation: true,
      });
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== STORAGE_KEY &&
        event.key !== SOURCE_STORAGE_KEY
      ) {
        return;
      }
      syncFromStorage();
    };

    const handleLocationSync = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (!isWeatherLocationSyncDetail(event.detail)) return;
      setState({
        location: event.detail.location,
        source: event.detail.source,
        hasStoredLocation: true,
      });
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCATION_SYNC_EVENT, handleLocationSync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCATION_SYNC_EVENT, handleLocationSync);
    };
  }, []);

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
