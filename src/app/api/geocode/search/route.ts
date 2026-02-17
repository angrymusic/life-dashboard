import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  parseBooleanEnv,
  parsePositiveIntEnv,
  resolveRateLimitClientKey,
} from "@/server/request-guards";
import { requireUser } from "@/server/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenMeteoGeocodingResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
};

type OpenMeteoGeocodingResponse = {
  results?: OpenMeteoGeocodingResult[];
};

function buildSearchUrl(query: string, language: string) {
  const params = new URLSearchParams({
    name: query,
    count: "8",
    language,
    format: "json",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

function uniqueParts(parts: string[]) {
  return parts.filter((part, index) => parts.indexOf(part) === index);
}

function toLocationLabel(item: OpenMeteoGeocodingResult) {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const admin1 = typeof item.admin1 === "string" ? item.admin1.trim() : "";
  const country = typeof item.country === "string" ? item.country.trim() : "";
  const parts = uniqueParts([name, admin1, country].filter(Boolean));
  if (parts.length === 0) return null;
  return parts.join(", ");
}

function normalizeLanguage(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/^[a-z]{2,8}$/.test(normalized)) return normalized;
  return "ko";
}

export async function GET(request: Request) {
  const requireAuth = parseBooleanEnv(
    process.env.GEOCODE_REQUIRE_AUTH,
    true
  );
  const userResult = requireAuth ? await requireUser() : null;
  if (userResult && !userResult.ok) return userResult.response;
  const clientKey = userResult
    ? `user:${userResult.context.userId}`
    : resolveRateLimitClientKey(request);

  const rateLimit = await enforceRateLimit({
    key: `geocode-search:${clientKey}`,
    limit: parsePositiveIntEnv(process.env.GEOCODE_SEARCH_RATE_LIMIT, 60),
    windowMs: parsePositiveIntEnv(
      process.env.GEOCODE_SEARCH_RATE_WINDOW_MS,
      60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const language = normalizeLanguage(searchParams.get("language") ?? "ko");

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }
  if (query.length > 120) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }

  try {
    const url = buildSearchUrl(query, language);
    const timeoutMs = parsePositiveIntEnv(
      process.env.GEOCODE_SEARCH_TIMEOUT_MS,
      5000
    );
    const response = await fetch(url, {
      headers: { "User-Agent": "lifedashboard" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Geocode search failed." }, { status: 502 });
    }
    const payload = (await response.json()) as OpenMeteoGeocodingResponse;
    const results = Array.isArray(payload.results) ? payload.results : [];

    const normalized = results
      .map((item) => {
        if (
          typeof item.latitude !== "number" ||
          typeof item.longitude !== "number"
        ) {
          return null;
        }
        const label = toLocationLabel(item);
        if (!label) return null;
        return {
          label,
          latitude: item.latitude,
          longitude: item.longitude,
        };
      })
      .filter((item): item is { label: string; latitude: number; longitude: number } =>
        Boolean(item)
      );

    return NextResponse.json({ results: normalized });
  } catch {
    return NextResponse.json({ error: "Geocode search failed." }, { status: 502 });
  }
}
