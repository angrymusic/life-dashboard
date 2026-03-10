const APP_SHELL_CACHE = "lifedashboard-app-shell-v1";
const STATIC_ASSET_CACHE = "lifedashboard-static-v1";
const DOCUMENT_CACHE = "lifedashboard-documents-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);

      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (!response.ok) return;
          await cache.put(url, response);
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = new Set([
        APP_SHELL_CACHE,
        STATIC_ASSET_CACHE,
        DOCUMENT_CACHE,
      ]);
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) => {
          if (expectedCaches.has(cacheName)) return Promise.resolve(false);
          return caches.delete(cacheName);
        })
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(DOCUMENT_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse =
      (await cache.match(request)) ||
      (await caches.match("/")) ||
      (await caches.match(OFFLINE_URL));

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

async function handleStaticAssetRequest(request) {
  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    void refreshStaticAsset(cache, request);
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // Ignore cache write failures so online asset requests still succeed.
    }
  }

  return response;
}

function refreshStaticAsset(cache, request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;
      return cache.put(request, response.clone()).then(() => response);
    })
    .catch(() => undefined);
}

function isStaticAssetRequest(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/_next/image")) return true;
  if (url.pathname === "/manifest.webmanifest") return true;

  if (request.destination === "style") return true;
  if (request.destination === "script") return true;
  if (request.destination === "font") return true;
  if (request.destination === "image") return true;

  return (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  );
}
