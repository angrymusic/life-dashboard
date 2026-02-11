import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nowIso, upsertWeatherCache } from "@/shared/db/db";
import { useWeatherCache, useWidget } from "@/shared/db/queries";
import type { Id } from "@/shared/db/schema";
import {
  buildLocationKey,
  buildOpenMeteoUrl,
  DEFAULT_WEATHER_LOCATION,
  parseOpenMeteoDaily,
  parseOpenMeteoHourly,
  WEATHER_CACHE_TTL_MS,
  WeatherForecastDay,
  WeatherHourly,
  WeatherLocation,
} from "@/feature/widgets/Weather/libs/openMeteo";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";

type WeatherForecast = {
  days: WeatherForecastDay[];
  hourly: WeatherHourly[];
  fetchedAt: string;
  locationKey: string;
};

type UseWeatherForecastOptions = {
  location?: WeatherLocation;
  days?: number;
  enabled?: boolean;
};

export function useWeatherForecast(
  widgetId: Id,
  options: UseWeatherForecastOptions = {}
) {
  const { t } = useI18n();
  const widget = useWidget(widgetId);
  const cacheEntry = useWeatherCache(widgetId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const location = options.location ?? DEFAULT_WEATHER_LOCATION;
  const days = options.days ?? 7;
  const enabled = options.enabled ?? true;
  const cacheKey = useMemo(() => buildLocationKey(location), [location]);

  const forecast = useMemo<WeatherForecast | null>(() => {
    if (!cacheEntry) return null;
    if (cacheEntry.locationKey !== cacheKey) return null;
    const daily = parseOpenMeteoDaily(cacheEntry.payload);
    const hourly = parseOpenMeteoHourly(cacheEntry.payload);
    if (daily.length === 0) return null;
    return {
      days: daily,
      hourly,
      fetchedAt: cacheEntry.fetchedAt,
      locationKey: cacheEntry.locationKey,
    };
  }, [cacheEntry, cacheKey]);

  const hasHourly = (forecast?.hourly.length ?? 0) > 0;

  const isCacheFresh = useMemo(() => {
    if (!cacheEntry) return false;
    if (cacheEntry.locationKey !== cacheKey) return false;
    if (!hasHourly) return false;
    const fetchedAt = Date.parse(cacheEntry.fetchedAt);
    if (Number.isNaN(fetchedAt)) return false;
    return Date.now() - fetchedAt < WEATHER_CACHE_TTL_MS;
  }, [cacheEntry, cacheKey, hasHourly]);

  const fetchForecast = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (!widget) return;
      if (!force && isCacheFresh) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const url = buildOpenMeteoUrl(location, days);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            t("날씨 정보를 불러오지 못했어요.", "Failed to load weather information.")
          );
        }

        const payload = (await response.json()) as unknown;
        const now = nowIso();

        await upsertWeatherCache({
          id: widgetId,
          widgetId,
          dashboardId: widget.dashboardId,
          locationKey: cacheKey,
          payload,
          fetchedAt: now,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? localizeErrorMessage(err.message, t)
            : t("날씨 정보를 불러오지 못했어요.", "Failed to load weather information.");
        setError(message);
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [cacheKey, days, enabled, isCacheFresh, location, t, widget, widgetId]
  );

  useEffect(() => {
    void fetchForecast(false);
  }, [fetchForecast]);

  return {
    forecast,
    isLoading,
    error,
    refresh: () => fetchForecast(true),
  };
}
