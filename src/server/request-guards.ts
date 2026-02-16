import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as {
  __lifedashboardRateLimitStore?: Map<string, RateLimitBucket>;
};

const rateLimitStore =
  globalForRateLimit.__lifedashboardRateLimitStore ?? new Map<string, RateLimitBucket>();

if (!globalForRateLimit.__lifedashboardRateLimitStore) {
  globalForRateLimit.__lifedashboardRateLimitStore = rateLimitStore;
}

function pruneRateLimitStore(now: number) {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function clientIpFromRequest(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

type EnforceRateLimitParams = {
  key: string;
  limit: number;
  windowMs: number;
};

type EnforceRateLimitResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function enforceRateLimit(
  params: EnforceRateLimitParams
): EnforceRateLimitResult {
  const now = Date.now();
  pruneRateLimitStore(now);

  const bucketKey = params.key;
  const existing = rateLimitStore.get(bucketKey);
  const activeBucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + params.windowMs };

  activeBucket.count += 1;
  rateLimitStore.set(bucketKey, activeBucket);

  if (activeBucket.count <= params.limit) {
    return { ok: true };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((activeBucket.resetAt - now) / 1000)
  );

  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    ),
  };
}

export function contentLengthExceeds(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;

  const parsed = Number(contentLength);
  if (!Number.isFinite(parsed) || parsed < 0) return false;
  return parsed > maxBytes;
}
