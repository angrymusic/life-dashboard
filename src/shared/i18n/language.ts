export type AppLanguage = "ko" | "en";

export const LANGUAGE_STORAGE_KEY = "lifedashboard.language";
export const LANGUAGE_COOKIE_KEY = "lifedashboard.lang";
export const DEFAULT_LANGUAGE: AppLanguage = "en";

function normalizeLanguageTag(value: string): AppLanguage | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function normalizeLanguage(value: string | null | undefined) {
  if (!value) return null;
  return normalizeLanguageTag(value);
}

export function detectLanguageFromList(
  values: ReadonlyArray<string> | null | undefined
): AppLanguage {
  if (!values || values.length === 0) return DEFAULT_LANGUAGE;
  for (const value of values) {
    const language = normalizeLanguageTag(value);
    if (language) return language;
  }
  return DEFAULT_LANGUAGE;
}

export function detectLanguageFromAcceptLanguage(
  acceptLanguageHeader: string | null | undefined
): AppLanguage {
  if (!acceptLanguageHeader) return DEFAULT_LANGUAGE;

  const candidates = acceptLanguageHeader
    .split(",")
    .map((segment) => {
      const [tagPart, ...params] = segment.trim().split(";");
      const tag = tagPart?.trim() ?? "";
      if (!tag) return null;

      const qualityParam = params.find((value) => value.trim().startsWith("q="));
      const quality = qualityParam
        ? Number(qualityParam.trim().slice(2))
        : 1;

      return {
        tag,
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((item): item is { tag: string; quality: number } => Boolean(item))
    .sort((a, b) => b.quality - a.quality);

  return detectLanguageFromList(candidates.map((item) => item.tag));
}

export function detectLanguageFromNavigator(
  navigatorObject: Pick<Navigator, "language" | "languages">
): AppLanguage {
  const candidates = [
    ...(navigatorObject.languages ?? []),
    navigatorObject.language,
  ].filter(Boolean) as string[];
  return detectLanguageFromList(candidates);
}

export function parseLanguageFromCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.trim().split("=");
    if (rawKey !== LANGUAGE_COOKIE_KEY) continue;
    const rawValue = rawValueParts.join("=").trim();
    return normalizeLanguage(rawValue);
  }

  return null;
}

export function detectLanguageFromRequest(request: Request): AppLanguage {
  const cookieLanguage = parseLanguageFromCookie(request.headers.get("cookie"));
  if (cookieLanguage) return cookieLanguage;
  return detectLanguageFromAcceptLanguage(request.headers.get("accept-language"));
}

export function toLocale(language: AppLanguage) {
  return language === "ko" ? "ko-KR" : "en-US";
}
