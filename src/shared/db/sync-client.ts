const SYNC_CLIENT_ID_STORAGE_KEY = "lifedashboard.syncClientId";

declare global {
  var __lifedashboardSyncClientId: string | undefined;
}

function createSyncClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getSyncClientId() {
  if (globalThis.__lifedashboardSyncClientId) {
    return globalThis.__lifedashboardSyncClientId;
  }

  let id: string | null = null;

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(SYNC_CLIENT_ID_STORAGE_KEY);
      if (stored && stored.trim()) {
        id = stored.trim();
      }
    } catch {
      // Ignore localStorage access issues.
    }
  }

  if (!id) {
    id = createSyncClientId();
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SYNC_CLIENT_ID_STORAGE_KEY, id);
    } catch {
      // Ignore localStorage write failures.
    }
  }

  globalThis.__lifedashboardSyncClientId = id;
  return id;
}
