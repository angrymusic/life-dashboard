import type { YMD } from "@/shared/db/schema";

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type WeatherForecastDay = {
  ymd: YMD;
  tempMax: number | null;
  tempMin: number | null;
  weatherCode: number | null;
};

export type WeatherHourly = {
  time: string;
  ymd: YMD;
  hour: number | null;
  temp: number | null;
  weatherCode: number | null;
};

type OpenMeteoDaily = {
  time?: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  weathercode?: number[];
  weather_code?: number[];
};

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: number[];
  weathercode?: number[];
  weather_code?: number[];
};

type OpenMeteoForecast = {
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
};

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  label: "Seoul",
};

export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

export function buildLocationKey(location: WeatherLocation) {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

export function buildOpenMeteoUrl(location: WeatherLocation, days = 7) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: "weathercode,temperature_2m_max,temperature_2m_min",
    hourly: "temperature_2m,weathercode",
    forecast_days: String(days),
    timezone: "auto",
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function parseOpenMeteoDaily(payload: unknown): WeatherForecastDay[] {
  if (!payload || typeof payload !== "object") return [];
  const daily = (payload as OpenMeteoForecast).daily;
  if (!daily || !Array.isArray(daily.time)) return [];

  const codes = daily.weathercode ?? daily.weather_code ?? [];
  const tempsMax = daily.temperature_2m_max ?? [];
  const tempsMin = daily.temperature_2m_min ?? [];

  const days: WeatherForecastDay[] = [];

  daily.time.forEach((ymd, index) => {
    if (typeof ymd !== "string") return;
    const weatherCode =
      typeof codes[index] === "number" ? codes[index] : null;
    const tempMax =
      typeof tempsMax[index] === "number" ? tempsMax[index] : null;
    const tempMin =
      typeof tempsMin[index] === "number" ? tempsMin[index] : null;

    days.push({
      ymd: ymd as YMD,
      tempMax,
      tempMin,
      weatherCode,
    });
  });

  return days;
}

export function parseOpenMeteoHourly(payload: unknown): WeatherHourly[] {
  if (!payload || typeof payload !== "object") return [];
  const hourly = (payload as OpenMeteoForecast).hourly;
  if (!hourly || !Array.isArray(hourly.time)) return [];

  const temps = hourly.temperature_2m ?? [];
  const codes = hourly.weathercode ?? hourly.weather_code ?? [];
  const items: WeatherHourly[] = [];

  hourly.time.forEach((time, index) => {
    if (typeof time !== "string") return;
    const [ymdPart, timePart] = time.split("T");
    const hourValue = timePart ? Number(timePart.split(":")[0]) : NaN;
    const hour = Number.isFinite(hourValue) ? hourValue : null;
    const temp = typeof temps[index] === "number" ? temps[index] : null;
    const weatherCode =
      typeof codes[index] === "number" ? codes[index] : null;

    items.push({
      time,
      ymd: (ymdPart || time) as YMD,
      hour,
      temp,
      weatherCode,
    });
  });

  return items;
}
