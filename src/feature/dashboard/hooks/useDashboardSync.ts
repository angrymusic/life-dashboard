import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDashboardSnapshot,
  flushOutbox,
  removeSharedDashboardLocally,
} from "@/shared/db/db";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import { useOutboxCount } from "@/shared/db/queries";
import { readJson } from "@/feature/dashboard/libs/readJson";

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

  useEffect(() => {
    lastRemoteUpdatedAtRef.current = null;
    setPendingRemoteUpdate(null);
  }, [activeDashboard?.id, activeDashboard?.groupId]);

  useEffect(() => {
    if (!activeDashboard?.updatedAt) return;
    lastRemoteUpdatedAtRef.current = activeDashboard.updatedAt;
  }, [activeDashboard?.updatedAt]);

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

    const currentDashboardId = activeDashboard.id;
    const groupId = activeDashboard.groupId;
    let cancelled = false;
    let timeoutId: number | undefined;

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
        }>(response);
        if (cancelled) return;
        if (response.status === 403 || response.status === 404) {
          await removeSharedDashboardLocally(currentDashboardId, groupId);
          cancelled = true;
          return;
        }
        if (!response.ok || !payload?.ok || !payload.updatedAt) return;

        const updatedAt = payload.updatedAt;
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
      } finally {
        if (!cancelled) schedule();
      }
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [activeDashboard?.groupId, activeDashboard?.id, isSignedIn]);

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
