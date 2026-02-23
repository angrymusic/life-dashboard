export const SITE_NAME = "Life Dashboard";
export const SITE_DESCRIPTION =
  "Local-first dashboard builder for planning tasks, notes, photos, weather, and shared life routines in one place.";
export const SITE_KEYWORDS = [
  "life dashboard",
  "local-first",
  "personal dashboard",
  "productivity",
  "todo",
  "memo",
  "calendar",
  "habit tracking",
  "shared dashboard",
];

const DEFAULT_SITE_URL = "http://localhost:3000";

function parseSiteUrl(value: string | undefined): URL | null {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseVercelUrl(value: string | undefined): URL | null {
  if (!value) return null;
  return parseSiteUrl(`https://${value}`);
}

export function getSiteUrl(): URL {
  const candidates = [
    parseSiteUrl(process.env.NEXT_PUBLIC_APP_URL),
    parseSiteUrl(process.env.NEXTAUTH_URL),
    parseVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    parseVercelUrl(process.env.VERCEL_URL),
    parseSiteUrl(DEFAULT_SITE_URL),
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return new URL(DEFAULT_SITE_URL);
}

export function getAbsoluteUrl(pathname = "/"): string {
  return new URL(pathname, getSiteUrl()).toString();
}
