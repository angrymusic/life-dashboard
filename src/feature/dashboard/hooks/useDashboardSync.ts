import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDashboardSnapshot,
  applyWidgetSnapshot,
  deleteWidgetSnapshot,
  flushOutbox,
  removeSharedDashboardLocally,
} from "@/shared/db/db";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import { useOutboxCount } from "@/shared/db/queries";
import { readJson } from "@/feature/dashboard/libs/readJson";
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
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const flushRef = useRef(false);
  const outboxCount = useOutboxCount();

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
    let timeoutId: number | undefined;
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

    const schedule = () => {
      timeoutId = window.setTimeout(poll, 10000);
    };

    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const response = await fetch(
          `/api/dashboards/${currentDashboardId}/updates`,
          { cache: "no-store" }
        );
        const payload = await readJson<{
          ok?: boolean;
          updatedAt?: string;
          clientId?: string;
        }>(response);
        if (cancelled) return;
        if (response.status === 403 || response.status === 404) {
          await removeSharedDashboardLocally(currentDashboardId, groupId);
          cancelled = true;
          return;
        }
        if (!response.ok || !payload?.ok || !payload.updatedAt) return;
        if (consumeSelfEcho(payload.updatedAt, payload.clientId)) return;
        handleRemoteUpdatedAt(payload.updatedAt);
      } finally {
        if (!cancelled) schedule();
      }
    };

    if (typeof window.EventSource === "function") {
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
    }

    schedule();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
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
    if (!isServerBootstrapReady) return;
    if (!isSignedIn) return;
    if (typeof outboxCount !== "number" || outboxCount === 0) return;
    if (flushRef.current) return;

    flushRef.current = true;
    void (async () => {
      try {
        await flushOutbox();
      } finally {
        flushRef.current = false;
      }
    })();
  }, [isSignedIn, isServerBootstrapReady, outboxCount]);

  return { pendingRemoteUpdate, applyRemoteUpdate };
}
