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

type ReadTextWithLimitResult =
  | { ok: true; raw: string }
  | { ok: false; response: ReturnType<typeof jsonError> };

async function readTextWithLimit(
  request: Request,
  maxBytes: number
): Promise<ReadTextWithLimitResult> {
  if (!request.body) {
    return { ok: true, raw: await request.text() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Ignore cancel errors.
        }
        return {
          ok: false,
          response: jsonError(413, "Payload too large", { maxBytes }),
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: jsonError(400, "Invalid request body"),
    };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, raw: new TextDecoder().decode(merged) };
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
      const rawResult = await readTextWithLimit(request, maxBytes);
      if (!rawResult.ok) return rawResult;
      const raw = rawResult.raw;
      if (byteLength(raw) > maxBytes) {
        return { ok: false, response: jsonError(413, "Payload too large", { maxBytes }) };
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
