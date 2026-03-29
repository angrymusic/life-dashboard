import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDashboardSnapshot,
  applyWidgetSnapshot,
  deleteWidgetSnapshot,
  flushOutbox,
  removeSharedDashboardLocally,
} from "@/shared/db/db";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import { useOutboxStatus } from "@/shared/db/queries";
import { readJson } from "@/feature/dashboard/libs/readJson";
import { getOutboxRetryDelay } from "@/feature/dashboard/libs/outboxRetry";
import { getSyncClientId } from "@/shared/db/sync-client";

type SyncParams = {
  activeDashboard?: Dashboard;
  dashboardId?: Id;
  widgets?: Widget[];
  isSignedIn: boolean;
  isServerBootstrapReady: boolean;
};

type SyncResult = {
  pendingRemoteUpdate: string | null;
  applyRemoteUpdate: () => Promise<void>;
};

export function useDashboardSync({
  activeDashboard,
  dashboardId,
  widgets,
  isSignedIn,
  isServerBootstrapReady,
}: SyncParams): SyncResult {
  const [pendingRemoteUpdate, setPendingRemoteUpdate] = useState<string | null>(
    null
  );
  const [outboxFlushTrigger, setOutboxFlushTrigger] = useState(0);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const flushRef = useRef(false);
  const pendingOutboxFlushRef = useRef(false);
  const outboxRetryTimeoutRef = useRef<number | null>(null);
  const outboxRetryAttemptRef = useRef(0);
  const outboxStatus = useOutboxStatus();
  const outboxCount = outboxStatus?.count;
  const outboxLatestUpdatedAt = outboxStatus?.latestUpdatedAt;

  const clearScheduledOutboxRetry = useCallback(() => {
    if (typeof window === "undefined") return;
    if (outboxRetryTimeoutRef.current === null) return;
    window.clearTimeout(outboxRetryTimeoutRef.current);
    outboxRetryTimeoutRef.current = null;
  }, []);

  const requestOutboxFlush = useCallback(
    (options?: { resetBackoff?: boolean }) => {
      if (!isServerBootstrapReady) return;
      if (!isSignedIn) return;
      if (typeof outboxCount !== "number" || outboxCount === 0) return;

      if (options?.resetBackoff) {
        outboxRetryAttemptRef.current = 0;
      }
      clearScheduledOutboxRetry();
      setOutboxFlushTrigger((current) => current + 1);
    },
    [clearScheduledOutboxRetry, isServerBootstrapReady, isSignedIn, outboxCount]
  );

  const scheduleOutboxRetry = useCallback(() => {
    if (typeof window === "undefined") return;
    clearScheduledOutboxRetry();
    outboxRetryAttemptRef.current += 1;
    const delay = getOutboxRetryDelay(outboxRetryAttemptRef.current);
    outboxRetryTimeoutRef.current = window.setTimeout(() => {
      outboxRetryTimeoutRef.current = null;
      setOutboxFlushTrigger((current) => current + 1);
    }, delay);
  }, [clearScheduledOutboxRetry]);

  const fetchAndApplySnapshot = useCallback(
    async (targetDashboardId: Id, groupId?: Id) => {
      const response = await fetch(
        `/api/dashboards/${targetDashboardId}/snapshot`
      );
      const payload = await readJson<{
        ok?: boolean;
        dashboard?: unknown;
        widgets?: unknown[];
        memos?: unknown[];
        todos?: unknown[];
        ddays?: unknown[];
        photos?: unknown[];
        moods?: unknown[];
        notices?: unknown[];
        metrics?: unknown[];
        metricEntries?: unknown[];
        calendarEvents?: unknown[];
        weatherCache?: unknown[];
        members?: unknown[];
      }>(response);
      if (response.status === 403 || response.status === 404) {
        if (groupId) {
          await removeSharedDashboardLocally(targetDashboardId, groupId);
        }
        return false;
      }
      if (!response.ok || !payload?.ok || !payload.dashboard) return false;

      const snapshot = {
        dashboard: payload.dashboard,
        widgets: payload.widgets ?? [],
        memos: payload.memos ?? [],
        todos: payload.todos ?? [],
        ddays: payload.ddays ?? [],
        photos: payload.photos ?? [],
        moods: payload.moods ?? [],
        notices: payload.notices ?? [],
        metrics: payload.metrics ?? [],
        metricEntries: payload.metricEntries ?? [],
        calendarEvents: payload.calendarEvents ?? [],
        weatherCache: payload.weatherCache ?? [],
        members: payload.members ?? [],
      } as Parameters<typeof applyDashboardSnapshot>[0];

      await applyDashboardSnapshot(snapshot);

      const updatedAt = (payload.dashboard as { updatedAt?: string })?.updatedAt;
      if (typeof updatedAt === "string") {
        lastRemoteUpdatedAtRef.current = updatedAt;
      }

      return true;
    },
    []
  );

  const fetchAndApplyWidgetSnapshot = useCallback(
    async (targetDashboardId: Id, widgetId: Id, groupId?: Id) => {
      const response = await fetch(
        `/api/dashboards/${targetDashboardId}/widgets/${widgetId}/snapshot`
      );
      if (response.status === 404) {
        await deleteWidgetSnapshot(widgetId);
        return true;
      }
      if (response.status === 403) {
        if (groupId) {
          await removeSharedDashboardLocally(targetDashboardId, groupId);
        }
        return false;
      }

      const payload = await readJson<{
        ok?: boolean;
        widget?: unknown;
        memos?: unknown[];
        todos?: unknown[];
        ddays?: unknown[];
        photos?: unknown[];
        moods?: unknown[];
        notices?: unknown[];
        metrics?: unknown[];
        metricEntries?: unknown[];
        calendarEvents?: unknown[];
        weatherCache?: unknown[];
      }>(response);
      if (!response.ok || !payload?.ok || !payload.widget) return false;

      const widgetSnapshot = {
        widget: payload.widget,
        memos: payload.memos ?? [],
        todos: payload.todos ?? [],
        ddays: payload.ddays ?? [],
        photos: payload.photos ?? [],
        moods: payload.moods ?? [],
        notices: payload.notices ?? [],
        metrics: payload.metrics ?? [],
        metricEntries: payload.metricEntries ?? [],
        calendarEvents: payload.calendarEvents ?? [],
        weatherCache: payload.weatherCache ?? [],
      } as Parameters<typeof applyWidgetSnapshot>[0];

      await applyWidgetSnapshot(widgetSnapshot);
      return true;
    },
    []
  );

  const applyRemoteUpdate = useCallback(async () => {
    if (!activeDashboard?.id || !activeDashboard.groupId) return;
    const applied = await fetchAndApplySnapshot(
      activeDashboard.id,
      activeDashboard.groupId
    );
    if (applied) {
      setPendingRemoteUpdate(null);
    }
  }, [activeDashboard?.groupId, activeDashboard?.id, fetchAndApplySnapshot]);

  const syncLastSeenUpdatedAt = useCallback((updatedAt: string) => {
    if (!updatedAt) return;
    const lastSeen = lastRemoteUpdatedAtRef.current;
    if (!lastSeen || updatedAt > lastSeen) {
      lastRemoteUpdatedAtRef.current = updatedAt;
    }
  }, []);

  const handleRemoteUpdatedAt = useCallback((updatedAt: string) => {
    if (!updatedAt) return;

    const lastSeen = lastRemoteUpdatedAtRef.current;
    if (!lastSeen) {
      setPendingRemoteUpdate(updatedAt);
      lastRemoteUpdatedAtRef.current = updatedAt;
      return;
    }
    if (updatedAt <= lastSeen) return;

    setPendingRemoteUpdate((current) => {
      if (current && updatedAt <= current) return current;
      return updatedAt;
    });
    lastRemoteUpdatedAtRef.current = updatedAt;
  }, []);

  useEffect(() => {
    lastRemoteUpdatedAtRef.current = null;
    setPendingRemoteUpdate(null);
  }, [activeDashboard?.id, activeDashboard?.groupId]);

  useEffect(() => {
    if (!activeDashboard?.updatedAt) return;
    syncLastSeenUpdatedAt(activeDashboard.updatedAt);
    setPendingRemoteUpdate((current) => {
      if (!current) return current;
      if (activeDashboard.updatedAt >= current) return null;
      return current;
    });
  }, [activeDashboard?.updatedAt, syncLastSeenUpdatedAt]);

  useEffect(() => {
    if (!activeDashboard?.groupId) return;
    if (!isSignedIn) return;

    void (async () => {
      const applied = await fetchAndApplySnapshot(
        activeDashboard.id,
        activeDashboard.groupId
      );
      if (applied) {
        setPendingRemoteUpdate(null);
      }
    })();
  }, [activeDashboard?.id, activeDashboard?.groupId, fetchAndApplySnapshot, isSignedIn]);

  useEffect(() => {
    if (!dashboardId) return;
    if (activeDashboard?.groupId) return;
    if (!isSignedIn) return;
    if (widgets === undefined || widgets.length > 0) return;

    void (async () => {
      await fetchAndApplySnapshot(dashboardId);
    })();
  }, [dashboardId, activeDashboard?.groupId, fetchAndApplySnapshot, isSignedIn, widgets]);

  useEffect(() => {
    if (!activeDashboard?.groupId) return;
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;

    const currentDashboardId = activeDashboard.id;
    const groupId = activeDashboard.groupId;
    const syncClientId = getSyncClientId();
    let cancelled = false;
    const inFlightWidgetUpdates = new Set<Id>();
    const queuedWidgetUpdates = new Map<
      Id,
      { widgetId: Id; type: "upsert" | "delete"; updatedAt?: string }
    >();

    const acknowledgeUpdatedAt = (updatedAt: string) => {
      syncLastSeenUpdatedAt(updatedAt);
      setPendingRemoteUpdate((current) => {
        if (!current) return current;
        if (updatedAt >= current) return null;
        return current;
      });
    };

    const consumeSelfEcho = (updatedAt: string, sourceClientId?: string) => {
      if (!sourceClientId || sourceClientId !== syncClientId) return false;
      acknowledgeUpdatedAt(updatedAt);
      return true;
    };

    const handleBaselineUpdatedAt = (updatedAt: string, sourceClientId?: string) => {
      if (consumeSelfEcho(updatedAt, sourceClientId)) return;

      const lastSeen = lastRemoteUpdatedAtRef.current;
      if (lastSeen && updatedAt > lastSeen) {
        handleRemoteUpdatedAt(updatedAt);
        return;
      }

      syncLastSeenUpdatedAt(updatedAt);
    };

    const parseAndHandleUpdatedAt = (
      data: string,
      options?: { baseline?: boolean }
    ) => {
      try {
        const payload = JSON.parse(data) as { updatedAt?: string; clientId?: string };
        if (typeof payload.updatedAt === "string") {
          if (options?.baseline) {
            handleBaselineUpdatedAt(payload.updatedAt, payload.clientId);
          } else {
            if (consumeSelfEcho(payload.updatedAt, payload.clientId)) return;
            handleRemoteUpdatedAt(payload.updatedAt);
          }
        }
      } catch {
        // Ignore malformed SSE payloads and continue listening.
      }
    };

    const applyWidgetUpdate = (payload: {
      widgetId: Id;
      type: "upsert" | "delete";
      updatedAt?: string;
    }) => {
      const { widgetId } = payload;
      if (inFlightWidgetUpdates.has(widgetId)) {
        queuedWidgetUpdates.set(widgetId, payload);
        return;
      }

      inFlightWidgetUpdates.add(widgetId);
      void (async () => {
        try {
          if (payload.type === "delete") {
            await deleteWidgetSnapshot(widgetId);
            if (typeof payload.updatedAt === "string") {
              acknowledgeUpdatedAt(payload.updatedAt);
            }
            return;
          }

          const applied = await fetchAndApplyWidgetSnapshot(
            currentDashboardId,
            widgetId,
            groupId
          );
          if (applied && typeof payload.updatedAt === "string") {
            acknowledgeUpdatedAt(payload.updatedAt);
            return;
          }
          if (!applied && typeof payload.updatedAt === "string") {
            handleRemoteUpdatedAt(payload.updatedAt);
          }
        } finally {
          inFlightWidgetUpdates.delete(widgetId);
          const queuedPayload = queuedWidgetUpdates.get(widgetId);
          if (!queuedPayload) return;
          queuedWidgetUpdates.delete(widgetId);
          applyWidgetUpdate(queuedPayload);
        }
      })();
    };

    const parseAndHandleWidgetUpdated = (data: string) => {
      try {
        const payload = JSON.parse(data) as {
          widgetId?: string;
          type?: "upsert" | "delete";
          updatedAt?: string;
          clientId?: string;
        };
        if (typeof payload.widgetId !== "string") return;
        if (payload.type !== "upsert" && payload.type !== "delete") return;

        if (typeof payload.updatedAt === "string") {
          if (consumeSelfEcho(payload.updatedAt, payload.clientId)) return;
        } else if (payload.clientId && payload.clientId === syncClientId) {
          return;
        }

        applyWidgetUpdate({
          widgetId: payload.widgetId,
          type: payload.type,
          updatedAt: payload.updatedAt,
        });
      } catch {
        // Ignore malformed SSE payloads and continue listening.
      }
    };

    if (typeof window.EventSource !== "function") return;

    const eventSource = new window.EventSource(
      `/api/dashboards/${currentDashboardId}/updates/stream`
    );

    const handleReady = (event: Event) => {
      const message = event as MessageEvent<string>;
      parseAndHandleUpdatedAt(message.data, { baseline: true });
    };

    const handleDashboardUpdated = (event: Event) => {
      const message = event as MessageEvent<string>;
      parseAndHandleUpdatedAt(message.data);
    };

    const handleWidgetUpdated = (event: Event) => {
      const message = event as MessageEvent<string>;
      parseAndHandleWidgetUpdated(message.data);
    };

    const handleForbidden = () => {
      if (cancelled) return;
      cancelled = true;
      eventSource.close();
      void removeSharedDashboardLocally(currentDashboardId, groupId);
    };

    eventSource.addEventListener("ready", handleReady);
    eventSource.addEventListener("dashboard-updated", handleDashboardUpdated);
    eventSource.addEventListener("widget-updated", handleWidgetUpdated);
    eventSource.addEventListener("forbidden", handleForbidden);

    return () => {
      cancelled = true;
      eventSource.removeEventListener("ready", handleReady);
      eventSource.removeEventListener("dashboard-updated", handleDashboardUpdated);
      eventSource.removeEventListener("widget-updated", handleWidgetUpdated);
      eventSource.removeEventListener("forbidden", handleForbidden);
      eventSource.close();
    };
  }, [
    activeDashboard?.groupId,
    activeDashboard?.id,
    fetchAndApplyWidgetSnapshot,
    handleRemoteUpdatedAt,
    isSignedIn,
    syncLastSeenUpdatedAt,
  ]);

  useEffect(() => {
    if (!isServerBootstrapReady || !isSignedIn) {
      pendingOutboxFlushRef.current = false;
      outboxRetryAttemptRef.current = 0;
      clearScheduledOutboxRetry();
      return;
    }
    if (typeof outboxCount !== "number" || outboxCount === 0) {
      pendingOutboxFlushRef.current = false;
      outboxRetryAttemptRef.current = 0;
      clearScheduledOutboxRetry();
      return;
    }
    if (flushRef.current) {
      pendingOutboxFlushRef.current = true;
      return;
    }

    pendingOutboxFlushRef.current = false;
    clearScheduledOutboxRetry();
    let cancelled = false;
    flushRef.current = true;
    void (async () => {
      try {
        const result = await flushOutbox();
        if (cancelled) return;
        if (!result.ok) {
          scheduleOutboxRetry();
          return;
        }
        outboxRetryAttemptRef.current = 0;
        clearScheduledOutboxRetry();
      } catch {
        if (cancelled) return;
        scheduleOutboxRetry();
      } finally {
        flushRef.current = false;
        if (!cancelled && pendingOutboxFlushRef.current) {
          pendingOutboxFlushRef.current = false;
          setOutboxFlushTrigger((current) => current + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clearScheduledOutboxRetry,
    isSignedIn,
    isServerBootstrapReady,
    outboxCount,
    outboxLatestUpdatedAt,
    outboxFlushTrigger,
    scheduleOutboxRetry,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      requestOutboxFlush({ resetBackoff: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      requestOutboxFlush({ resetBackoff: true });
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestOutboxFlush]);

  useEffect(() => {
    return () => {
      clearScheduledOutboxRetry();
    };
  }, [clearScheduledOutboxRetry]);

  return { pendingRemoteUpdate, applyRemoteUpdate };
}
