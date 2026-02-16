import { NextResponse } from "next/server";

type JsonErrorDetails = Record<string, unknown>;

export function jsonError(status: number, error: string, details?: JsonErrorDetails) {
  return NextResponse.json(
    { ok: false, error, ...(details ? { details } : {}) },
    { status }
  );
}

type JsonParseResult =
  | { ok: true; body: unknown }
  | { ok: false; response: ReturnType<typeof jsonError> };

type ParseJsonOptions = {
  maxBytes?: number;
};

function parseContentLength(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export async function parseJson(
  request: Request,
  options: ParseJsonOptions = {}
): Promise<JsonParseResult> {
  const maxBytes = options.maxBytes;
  if (typeof maxBytes === "number" && maxBytes > 0) {
    const contentLength = parseContentLength(request);
    if (contentLength !== null && contentLength > maxBytes) {
      return {
        ok: false,
        response: jsonError(413, "Payload too large", { maxBytes }),
      };
    }

    try {
      const raw = await request.text();
      if (byteLength(raw) > maxBytes) {
        return {
          ok: false,
          response: jsonError(413, "Payload too large", { maxBytes }),
        };
      }
      const body = JSON.parse(raw);
      return { ok: true, body };
    } catch {
      return { ok: false, response: jsonError(400, "Invalid JSON body") };
    }
  }

  try {
    const body = await request.json();
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON body") };
  }
}
