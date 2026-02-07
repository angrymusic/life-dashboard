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

export async function parseJson(request: Request): Promise<JsonParseResult> {
  try {
    const body = await request.json();
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON body") };
  }
}
