import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type CspMode = "enforce" | "report-only";

function resolveCspMode(): CspMode {
  const rawMode = (process.env.CSP_MODE ?? "enforce").trim().toLowerCase();
  return rawMode === "report-only" ? "report-only" : "enforce";
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary);
}

function buildCspValue(nonce: string, isDevelopment: boolean) {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSrc = ["'self'", "https://api.open-meteo.com"];

  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "wss:");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "manifest-src 'self'",
    "media-src 'self' blob:",
  ];

  if (!isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const cspValue = buildCspValue(nonce, isDevelopment);
  const cspMode = resolveCspMode();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const cspHeaderName =
    cspMode === "enforce"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

  response.headers.set(cspHeaderName, cspValue);
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|twitter-image|icon|apple-icon).*)",
  ],
};
