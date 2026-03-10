import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearManagedOfflineCaches,
  isManagedOfflineCacheName,
} from "./offlineCaches";

describe("offlineCaches", () => {
  const originalCaches = globalThis.caches;

  afterEach(() => {
    if (originalCaches === undefined) {
      delete (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;
      return;
    }

    globalThis.caches = originalCaches;
  });

  it("matches only managed offline caches", () => {
    expect(isManagedOfflineCacheName("lifedashboard-documents-v1")).toBe(true);
    expect(isManagedOfflineCacheName("another-app-cache")).toBe(false);
  });

  it("clears only managed offline caches", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    const keys = vi
      .fn()
      .mockResolvedValue([
        "lifedashboard-app-shell-v1",
        "third-party-cache",
        "lifedashboard-documents-v1",
      ]);

    globalThis.caches = {
      keys,
      delete: deleteCache,
    } as CacheStorage;

    await clearManagedOfflineCaches();

    expect(keys).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith("lifedashboard-app-shell-v1");
    expect(deleteCache).toHaveBeenCalledWith("lifedashboard-documents-v1");
    expect(deleteCache).not.toHaveBeenCalledWith("third-party-cache");
  });

  it("does nothing when Cache Storage is unavailable", async () => {
    delete (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;

    await expect(clearManagedOfflineCaches()).resolves.toBeUndefined();
  });
});
