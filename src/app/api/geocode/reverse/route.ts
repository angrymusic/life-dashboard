import { NextResponse } from "next/server";

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
  const { searchParams } = new URL(request.url);
  const latitude = parseNumber(searchParams.get("lat"));
  const longitude = parseNumber(searchParams.get("lon"));
  const language = searchParams.get("language") ?? "ko";

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
    const response = await fetch(url, {
      headers: {
        "User-Agent": "lifedashboard",
      },
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
