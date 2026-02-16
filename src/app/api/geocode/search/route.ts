import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const language = (searchParams.get("language") ?? "ko").trim() || "ko";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = buildSearchUrl(query, language);
    const response = await fetch(url, {
      headers: { "User-Agent": "lifedashboard" },
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
