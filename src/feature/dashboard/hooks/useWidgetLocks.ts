import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dashboard, Id } from "@/shared/db/schema";
import { readJson } from "@/feature/dashboard/libs/readJson";
import type { WidgetLock, WidgetLockMap } from "@/feature/dashboard/types/widgetLock";

type UseWidgetLocksParams = {
  activeDashboard?: Dashboard;
  isSignedIn: boolean;
};

type UseWidgetLocksResult = {
  lockEnabled: boolean;
  widgetLocks: WidgetLockMap;
  touchWidgetLock: (widgetId: Id) => void;
  releaseWidgetLock: (widgetId: Id) => void;
  releaseAllWidgetLocks: () => void;
};

const LOCK_FALLBACK_POLL_INTERVAL_MS = 5000;
const LOCK_HEARTBEAT_INTERVAL_MS = 15000;
const LOCK_IDLE_RELEASE_MS = 20000;
const LOCK_EXPIRY_PRUNE_INTERVAL_MS = 1000;
const MIN_TOUCH_ACQUIRE_GAP_MS = 2500;

function toWidgetLockMap(items: WidgetLock[]) {
  const next: WidgetLockMap = {};
  for (const item of items) {
    next[item.widgetId] = item;
  }
  return next;
}

function isWidgetLockArray(value: unknown): value is WidgetLock[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const lock = item as Partial<WidgetLock>;
    return (
      typeof lock.widgetId === "string" &&
      typeof lock.userId === "string" &&
      typeof lock.displayName === "string" &&
      typeof lock.expiresAt === "string" &&
      typeof lock.isMine === "boolean"
    );
  });
}

function isWidgetLock(value: unknown): value is WidgetLock {
  return isWidgetLockArray([value]);
}

function parseJsonPayload<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function useWidgetLocks({
  activeDashboard,
  isSignedIn,
}: UseWidgetLocksParams): UseWidgetLocksResult {
  const dashboardId = activeDashboard?.id;
  const lockEligible = Boolean(activeDashboard?.groupId && isSignedIn && dashboardId);
  const endpoint = lockEligible ? `/api/dashboards/${dashboardId}/widget-locks` : null;
  const streamEndpoint = lockEligible
    ? `/api/dashboards/${dashboardId}/updates/stream`
    : null;

  const [widgetLocks, setWidgetLocks] = useState<WidgetLockMap>({});
  const [lockStorageEnabled, setLockStorageEnabled] = useState(true);
  const lockEnabled = lockEligible && lockStorageEnabled;
  const widgetLocksRef = useRef(widgetLocks);
  const touchedAtRef = useRef<Map<Id, number>>(new Map());
  const inFlightRef = useRef<Set<Id>>(new Set());
  const lastAcquireAtRef = useRef<Map<Id, number>>(new Map());

  const resetLocalState = useCallback(() => {
    setWidgetLocks({});
    touchedAtRef.current.clear();
    inFlightRef.current.clear();
    lastAcquireAtRef.current.clear();
  }, []);

  useEffect(() => {
    setLockStorageEnabled(true);
  }, [lockEligible, dashboardId]);

  useEffect(() => {
    widgetLocksRef.current = widgetLocks;
  }, [widgetLocks]);

  const applySingleLock = useCallback((lock: WidgetLock) => {
    setWidgetLocks((current) => ({ ...current, [lock.widgetId]: lock }));
  }, []);

  const clearSingleLock = useCallback((widgetId: Id) => {
    setWidgetLocks((current) => {
      if (!current[widgetId]) return current;
      const { [widgetId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const fetchLocks = useCallback(async () => {
    if (!endpoint || !lockEligible) return;

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await readJson<{
        ok?: boolean;
        enabled?: boolean;
        locks?: unknown;
      }>(response);
      if (!response.ok || !payload?.ok) return;
      if (!payload.enabled) {
        setLockStorageEnabled(false);
        resetLocalState();
        return;
      }
      if (!isWidgetLockArray(payload.locks)) return;
      setLockStorageEnabled(true);
      setWidgetLocks(toWidgetLockMap(payload.locks));
    } catch {
      // Ignore lock refresh failures and keep current lock state.
    }
  }, [endpoint, lockEligible, resetLocalState]);

  const acquireWidgetLock = useCallback(
    async (widgetId: Id) => {
      if (!endpoint || !lockEnabled) return;
      if (inFlightRef.current.has(widgetId)) return;

      inFlightRef.current.add(widgetId);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgetId }),
        });
        const payload = await readJson<{
          ok?: boolean;
          enabled?: boolean;
          lock?: WidgetLock;
        }>(response);

        if (response.status === 423 && payload?.lock) {
          applySingleLock(payload.lock);
          touchedAtRef.current.delete(widgetId);
          return;
        }

        if (!response.ok || !payload?.ok) return;
        if (!payload.enabled) {
          setLockStorageEnabled(false);
          resetLocalState();
          return;
        }
        if (!payload.lock) return;
        setLockStorageEnabled(true);
        applySingleLock(payload.lock);
      } catch {
        // Ignore lock acquire failures. Next event/refresh will reconcile state.
      } finally {
        inFlightRef.current.delete(widgetId);
      }
    },
    [applySingleLock, endpoint, lockEnabled, resetLocalState]
  );

  const releaseWidgetLock = useCallback(
    (widgetId: Id) => {
      touchedAtRef.current.delete(widgetId);
      lastAcquireAtRef.current.delete(widgetId);

      if (!endpoint || !lockEnabled) return;
      const current = widgetLocksRef.current[widgetId];
      if (current?.isMine) {
        clearSingleLock(widgetId);
      }

      void (async () => {
        try {
          const response = await fetch(
            `${endpoint}?widgetId=${encodeURIComponent(widgetId)}`,
            { method: "DELETE" }
          );
          const payload = await readJson<{ enabled?: boolean; lock?: WidgetLock }>(
            response
          );
          if (payload?.enabled === false) {
            setLockStorageEnabled(false);
            resetLocalState();
            return;
          }
          if (response.status === 423 && payload?.lock) {
            applySingleLock(payload.lock);
          }
        } catch {
          // Ignore release failures. TTL expiration will recover eventually.
        }
      })();
    },
    [applySingleLock, clearSingleLock, endpoint, lockEnabled, resetLocalState]
  );

  const releaseAllWidgetLocks = useCallback(() => {
    touchedAtRef.current.clear();
    lastAcquireAtRef.current.clear();

    if (!endpoint || !lockEnabled) return;

    setWidgetLocks((current) => {
      let changed = false;
      const next: WidgetLockMap = {};

      for (const [widgetId, lock] of Object.entries(current)) {
        if (lock.isMine) {
          changed = true;
          continue;
        }
        next[widgetId] = lock;
      }

      return changed ? next : current;
    });

    void (async () => {
      try {
        const response = await fetch(endpoint, { method: "DELETE" });
        const payload = await readJson<{ enabled?: boolean }>(response);
        if (payload?.enabled === false) {
          setLockStorageEnabled(false);
          resetLocalState();
        }
      } catch {
        // Ignore release failures. TTL expiration will recover eventually.
      }
    })();
  }, [endpoint, lockEnabled, resetLocalState]);

  const touchWidgetLock = useCallback(
    (widgetId: Id) => {
      if (!endpoint || !lockEnabled) return;

      const currentLock = widgetLocksRef.current[widgetId];
      if (currentLock && !currentLock.isMine) return;

      for (const activeWidgetId of touchedAtRef.current.keys()) {
        if (activeWidgetId === widgetId) continue;
        releaseWidgetLock(activeWidgetId);
      }

      const now = Date.now();
      touchedAtRef.current.set(widgetId, now);

      const lastAcquire = lastAcquireAtRef.current.get(widgetId) ?? 0;
      if (now - lastAcquire < MIN_TOUCH_ACQUIRE_GAP_MS) return;

      lastAcquireAtRef.current.set(widgetId, now);
      void acquireWidgetLock(widgetId);
    },
    [acquireWidgetLock, endpoint, lockEnabled, releaseWidgetLock]
  );

  useEffect(() => {
    if (!endpoint || !lockEligible) {
      resetLocalState();
      return;
    }

    void fetchLocks();

    if (typeof window.EventSource === "function" && streamEndpoint) {
      const eventSource = new window.EventSource(streamEndpoint);

      const handleWidgetLockReady = (event: Event) => {
        const message = event as MessageEvent<string>;
        const payload = parseJsonPayload<{ enabled?: boolean; locks?: unknown }>(
          message.data
        );
        if (!payload) return;
        if (!payload.enabled) {
          setLockStorageEnabled(false);
          resetLocalState();
          return;
        }
        if (!isWidgetLockArray(payload.locks)) return;
        setLockStorageEnabled(true);
        setWidgetLocks(toWidgetLockMap(payload.locks));
      };

      const handleWidgetLockUpdated = (event: Event) => {
        const message = event as MessageEvent<string>;
        const payload = parseJsonPayload<{
          type?: "upsert" | "delete";
          lock?: unknown;
          widgetId?: string;
        }>(message.data);
        if (!payload) return;
        if (payload.type === "upsert" && payload.lock) {
          if (isWidgetLock(payload.lock)) {
            setLockStorageEnabled(true);
            applySingleLock(payload.lock);
          }
          return;
        }
        if (payload.type === "delete" && typeof payload.widgetId === "string") {
          clearSingleLock(payload.widgetId);
        }
      };

      const handleForbidden = () => {
        resetLocalState();
      };

      eventSource.addEventListener("widget-lock-ready", handleWidgetLockReady);
      eventSource.addEventListener("widget-lock-updated", handleWidgetLockUpdated);
      eventSource.addEventListener("forbidden", handleForbidden);

      return () => {
        eventSource.removeEventListener("widget-lock-ready", handleWidgetLockReady);
        eventSource.removeEventListener("widget-lock-updated", handleWidgetLockUpdated);
        eventSource.removeEventListener("forbidden", handleForbidden);
        eventSource.close();
      };
    }

    const intervalId = window.setInterval(() => {
      void fetchLocks();
    }, LOCK_FALLBACK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    endpoint,
    lockEligible,
    streamEndpoint,
    fetchLocks,
    applySingleLock,
    clearSingleLock,
    resetLocalState,
  ]);

  useEffect(() => {
    if (!endpoint || !lockEnabled) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      for (const [widgetId, touchedAt] of touchedAtRef.current.entries()) {
        const currentLock = widgetLocksRef.current[widgetId];
        if (currentLock && !currentLock.isMine) {
          touchedAtRef.current.delete(widgetId);
          continue;
        }

        if (now - touchedAt > LOCK_IDLE_RELEASE_MS) {
          releaseWidgetLock(widgetId);
          continue;
        }

        lastAcquireAtRef.current.set(widgetId, now);
        void acquireWidgetLock(widgetId);
      }
    }, LOCK_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [acquireWidgetLock, endpoint, lockEnabled, releaseWidgetLock]);

  useEffect(() => {
    if (!lockEnabled) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      for (const [widgetId, lock] of Object.entries(widgetLocksRef.current)) {
        const expiresAtMs = Date.parse(lock.expiresAt);
        if (!Number.isFinite(expiresAtMs)) continue;
        if (expiresAtMs <= now) {
          clearSingleLock(widgetId);
        }
      }
    }, LOCK_EXPIRY_PRUNE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [clearSingleLock, lockEnabled]);

  useEffect(() => {
    if (!endpoint || !lockEnabled) return;

    return () => {
      void fetch(endpoint, { method: "DELETE", keepalive: true });
    };
  }, [endpoint, lockEnabled]);

  useEffect(() => {
    if (!endpoint || !lockEnabled) return;

    const handleBeforeUnload = () => {
      void fetch(endpoint, { method: "DELETE", keepalive: true });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [endpoint, lockEnabled]);

  return useMemo(
    () => ({
      lockEnabled,
      widgetLocks,
      touchWidgetLock,
      releaseWidgetLock,
      releaseAllWidgetLocks,
    }),
    [
      lockEnabled,
      widgetLocks,
      touchWidgetLock,
      releaseWidgetLock,
      releaseAllWidgetLocks,
    ]
  );
}
