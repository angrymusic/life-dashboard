import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/server/prisma";
import { createHash } from "crypto";
import { isIP } from "net";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9_-]{1,128}$/;
const trustedProxyIpHeaders = new Set([
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
]);

const globalForRateLimit = globalThis as {
  __lifedashboardRateLimitStore?: Map<string, RateLimitBucket>;
  __lifedashboardRateLimitPrunedAt?: number;
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

function maybePruneDatabaseRateLimits(nowMs: number) {
  const pruneIntervalMs = parsePositiveIntEnv(
    process.env.RATE_LIMIT_PRUNE_INTERVAL_MS,
    5 * 60 * 1000
  );
  const lastPrunedAt = globalForRateLimit.__lifedashboardRateLimitPrunedAt ?? 0;
  if (nowMs - lastPrunedAt < pruneIntervalMs) return;

  globalForRateLimit.__lifedashboardRateLimitPrunedAt = nowMs;
  void prisma.apiRateLimit
    .deleteMany({
      where: {
        resetAt: {
          lte: new Date(nowMs),
        },
      },
    })
    .catch(() => {
      // Ignore prune errors.
    });
}

export function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function isSafeIdentifier(value: string) {
  return SAFE_IDENTIFIER_PATTERN.test(value);
}

export function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function clientIpFromRequest(request: Request) {
  const trustProxyHeaders = parseBooleanEnv(
    process.env.TRUST_PROXY_HEADERS,
    false
  );
  if (!trustProxyHeaders) {
    return null;
  }

  const requestedHeader = (process.env.TRUST_PROXY_IP_HEADER ?? "cf-connecting-ip")
    .trim()
    .toLowerCase();
  const trustedHeader = trustedProxyIpHeaders.has(requestedHeader)
    ? requestedHeader
    : "cf-connecting-ip";
  const headerValue = request.headers.get(trustedHeader);
  if (!headerValue) return null;

  const parsedIp =
    trustedHeader === "x-forwarded-for"
      ? headerValue.split(",")[0]?.trim()
      : headerValue.trim();
  if (!parsedIp) return null;
  if (!isIP(parsedIp)) {
    return null;
  }

  return parsedIp;
}

function hashRateLimitFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function resolveRateLimitClientKey(request: Request) {
  const ip = clientIpFromRequest(request);
  if (ip) return `ip:${ip}`;

  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const language = request.headers.get("accept-language")?.trim() ?? "";
  const fingerprint = [userAgent, language].filter(Boolean).join("|");
  if (!fingerprint) return "unknown";

  return `ua:${hashRateLimitFingerprint(fingerprint)}`;
}

type EnforceRateLimitParams = {
  key: string;
  limit: number;
  windowMs: number;
};

type EnforceRateLimitResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

type ResolvedRateLimit = {
  count: number;
  resetAt: number;
};

function enforceRateLimitInMemory(
  params: EnforceRateLimitParams
): ResolvedRateLimit {
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
  return { count: activeBucket.count, resetAt: activeBucket.resetAt };
}

async function enforceRateLimitInDatabase(
  params: EnforceRateLimitParams
): Promise<ResolvedRateLimit> {
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>(
    Prisma.sql`
      INSERT INTO "ApiRateLimit" ("key", "count", "resetAt", "createdAt", "updatedAt")
      VALUES (
        ${params.key},
        1,
        NOW() + (${params.windowMs} * INTERVAL '1 millisecond'),
        NOW(),
        NOW()
      )
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "ApiRateLimit"."resetAt" <= NOW() THEN 1
          ELSE "ApiRateLimit"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "ApiRateLimit"."resetAt" <= NOW()
            THEN NOW() + (${params.windowMs} * INTERVAL '1 millisecond')
          ELSE "ApiRateLimit"."resetAt"
        END,
        "updatedAt" = NOW()
      RETURNING "count", "resetAt";
    `
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Rate limit update failed");
  }

  const nowMs = Date.now();
  maybePruneDatabaseRateLimits(nowMs);
  return { count: row.count, resetAt: row.resetAt.getTime() };
}

function shouldUseDatabaseRateLimitBackend() {
  const backend = (process.env.RATE_LIMIT_BACKEND ?? "database")
    .trim()
    .toLowerCase();
  return backend !== "memory";
}

export async function enforceRateLimit(
  params: EnforceRateLimitParams
): Promise<EnforceRateLimitResult> {
  let resolved: ResolvedRateLimit;
  if (shouldUseDatabaseRateLimitBackend()) {
    try {
      resolved = await enforceRateLimitInDatabase(params);
    } catch {
      resolved = enforceRateLimitInMemory(params);
    }
  } else {
    resolved = enforceRateLimitInMemory(params);
  }

  if (resolved.count <= params.limit) {
    return { ok: true };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resolved.resetAt - Date.now()) / 1000)
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
