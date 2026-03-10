const OFFLINE_CACHE_PREFIX = "lifedashboard-";

export function isManagedOfflineCacheName(name: string) {
  return name.startsWith(OFFLINE_CACHE_PREFIX);
}

export async function clearManagedOfflineCaches() {
  if (typeof caches === "undefined") return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((cacheName) => {
      if (!isManagedOfflineCacheName(cacheName)) {
        return Promise.resolve(false);
      }
      return caches.delete(cacheName);
    })
  );
}
