import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  parsePositiveIntEnv,
  resolveRateLimitClientKey,
} from "@/server/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReverseGeocodeResponse = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
};

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeLanguage(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/^[a-z]{2,8}$/.test(normalized)) return normalized;
  return "ko";
}

function buildReverseGeocodeUrl(
  latitude: number,
  longitude: number,
  language: string
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: language,
  });
  return `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`;
}

function parseReverseGeocodeLabel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as ReverseGeocodeResponse;
  const locality = typeof data.locality === "string" ? data.locality : "";
  const city = typeof data.city === "string" ? data.city : "";
  const subdivision =
    typeof data.principalSubdivision === "string"
      ? data.principalSubdivision
      : "";
  const country =
    typeof data.countryName === "string" ? data.countryName : "";
  const primary = locality || city || subdivision;
  const parts = [primary, subdivision, country].filter(Boolean);
  const uniqueParts = parts.filter(
    (part, index) => parts.indexOf(part) === index
  );
  if (uniqueParts.length === 0) return null;
  return uniqueParts.join(" ");
}

export async function GET(request: Request) {
  const clientKey = resolveRateLimitClientKey(request);
  const rateLimit = await enforceRateLimit({
    key: `geocode-reverse:${clientKey}`,
    limit: parsePositiveIntEnv(process.env.GEOCODE_REVERSE_RATE_LIMIT, 60),
    windowMs: parsePositiveIntEnv(
      process.env.GEOCODE_REVERSE_RATE_WINDOW_MS,
      60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const latitude = parseNumber(searchParams.get("lat"));
  const longitude = parseNumber(searchParams.get("lon"));
  const language = normalizeLanguage(searchParams.get("language") ?? "ko");

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "Invalid coordinates." },
      { status: 400 }
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: "Coordinates out of range." },
      { status: 400 }
    );
  }

  try {
    const url = buildReverseGeocodeUrl(latitude, longitude, language);
    const timeoutMs = parsePositiveIntEnv(
      process.env.GEOCODE_REVERSE_TIMEOUT_MS,
      5000
    );
    const response = await fetch(url, {
      headers: {
        "User-Agent": "lifedashboard",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Reverse geocode failed." },
        { status: 502 }
      );
    }
    const payload = (await response.json()) as unknown;
    const label = parseReverseGeocodeLabel(payload);
    return NextResponse.json({ label });
  } catch {
    return NextResponse.json(
      { error: "Reverse geocode failed." },
      { status: 502 }
    );
  }
}
