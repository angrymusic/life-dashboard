import { NextResponse } from "next/server";
import {
  clientIpFromRequest,
  enforceRateLimit,
  parsePositiveIntEnv,
} from "@/server/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SpecialDayKind = "holiday" | "anniversary";

type DataGoKrItem = {
  locdate?: string | number;
  dateName?: string;
  isHoliday?: string;
  seq?: string | number;
};

type DataGoKrResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: DataGoKrItem | DataGoKrItem[];
      };
    };
  };
};

type SpecialDayItem = {
  ymd: string;
  name: string;
  kind: SpecialDayKind;
  seq?: string;
  isHoliday?: boolean;
};

const BASE_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheStore = new Map<
  string,
  { items: SpecialDayItem[]; expiresAt: number }
>();

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMonth(month: number) {
  return String(month).padStart(2, "0");
}

function normalizeLocdate(value: string | number | undefined) {
  let raw = "";
  if (typeof value === "number") {
    raw = String(value);
  } else if (typeof value === "string") {
    raw = value.trim();
  } else {
    return null;
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  return null;
}

function encodeServiceKey(serviceKey: string) {
  const trimmed = serviceKey.trim();
  if (!trimmed) return "";
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return trimmed;
  }
  return encodeURIComponent(trimmed);
}

function buildUrl(operation: string, params: URLSearchParams, serviceKey: string) {
  const keyParam = encodeServiceKey(serviceKey);
  return `${BASE_URL}/${operation}?${params.toString()}&ServiceKey=${keyParam}`;
}

function buildCacheKey(operation: string, year: number, month: number) {
  return `${operation}:${year}-${formatMonth(month)}`;
}

function readCache(key: string) {
  const cached = cacheStore.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return cached.items;
}

function writeCache(key: string, items: SpecialDayItem[]) {
  cacheStore.set(key, { items, expiresAt: Date.now() + CACHE_TTL_MS });
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}

function parseItems(
  payload: unknown,
  kind: SpecialDayKind
): { items: SpecialDayItem[]; error?: string } {
  if (!payload || typeof payload !== "object") return { items: [] };
  const response = (payload as DataGoKrResponse).response;
  const header = response?.header;
  if (header?.resultCode && !["00", "03"].includes(header.resultCode)) {
    return { items: [], error: header.resultMsg ?? "Data.go.kr error." };
  }
  const itemNode = response?.body?.items?.item;
  const items = Array.isArray(itemNode) ? itemNode : itemNode ? [itemNode] : [];
  const results: SpecialDayItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const normalized = item as DataGoKrItem;
    const ymd = normalizeLocdate(normalized.locdate);
    const name =
      typeof normalized.dateName === "string"
        ? normalized.dateName.trim()
        : "";
    if (!ymd || !name) continue;
    const isHoliday =
      normalized.isHoliday === "Y"
        ? true
        : normalized.isHoliday === "N"
          ? false
          : undefined;
    results.push({
      ymd,
      name,
      kind,
      seq:
        typeof normalized.seq === "number" || typeof normalized.seq === "string"
          ? String(normalized.seq)
          : undefined,
      isHoliday,
    });
  }

  return { items: results };
}

async function fetchSpecialDays(
  operation: string,
  kind: SpecialDayKind,
  year: number,
  month: number,
  serviceKey: string,
  timeoutMs: number
) {
  const cacheKey = buildCacheKey(operation, year, month);
  const cached = readCache(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    solYear: String(year),
    solMonth: formatMonth(month),
    numOfRows: "100",
    _type: "json",
  });

  const url = buildUrl(operation, params, serviceKey);
  const response = await fetch(url, {
    headers: { "User-Agent": "lifedashboard" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch special days.");
  }
  const payload = (await response.json()) as unknown;
  const parsed = parseItems(payload, kind);
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  writeCache(cacheKey, parsed.items);
  pruneCache();
  return parsed.items;
}

export async function GET(request: Request) {
  const clientIp = clientIpFromRequest(request) ?? "unknown";
  const rateLimit = await enforceRateLimit({
    key: `special-days:${clientIp}`,
    limit: parsePositiveIntEnv(process.env.SPECIAL_DAYS_RATE_LIMIT, 30),
    windowMs: parsePositiveIntEnv(
      process.env.SPECIAL_DAYS_RATE_WINDOW_MS,
      60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const year = parseNumber(searchParams.get("year"));
  const month = parseNumber(searchParams.get("month"));

  if (!year || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year." },
      { status: 400 }
    );
  }

  if (!month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Invalid month." },
      { status: 400 }
    );
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Missing DATA_GO_KR_SERVICE_KEY." },
      { status: 500 }
    );
  }

  try {
    const timeoutMs = parsePositiveIntEnv(
      process.env.SPECIAL_DAYS_TIMEOUT_MS,
      8000
    );
    const [holidays, anniversaries] = await Promise.all([
      fetchSpecialDays(
        "getRestDeInfo",
        "holiday",
        year,
        month,
        serviceKey,
        timeoutMs
      ),
      fetchSpecialDays(
        "getAnniversaryInfo",
        "anniversary",
        year,
        month,
        serviceKey,
        timeoutMs
      ),
    ]);

    const merged = [...holidays, ...anniversaries];
    const deduped = new Map<string, SpecialDayItem>();
    for (const item of merged) {
      const key = `${item.ymd}:${item.name}`;
      const existing = deduped.get(key);
      if (!existing || (existing.kind !== "holiday" && item.kind === "holiday")) {
        deduped.set(key, item);
      }
    }

    return NextResponse.json({
      items: Array.from(deduped.values()),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch special days." },
      { status: 502 }
    );
  }
}
