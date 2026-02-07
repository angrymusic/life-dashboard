import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateLocalProfileId, syncDashboardsFromServer } from "@/shared/db/db";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useEnsureDashboard } from "@/feature/dashboard/hooks/useEnsureDashboard";
import { readJson } from "@/feature/dashboard/libs/readJson";

type BootstrappingParams = {
  dashboards?: Dashboard[];
  authEmail: string | null;
  isSignedIn: boolean;
  isAuthLoading: boolean;
};

type BootstrappingResult = {
  activeDashboardId?: Id;
  setActiveDashboardIdByUser: (nextId?: Id) => void;
  dashboardError: string | null;
  isCreating: boolean;
  retry: () => void;
};

export function useDashboardBootstrapping({
  dashboards,
  authEmail,
  isSignedIn,
  isAuthLoading,
}: BootstrappingParams): BootstrappingResult {
  const [serverDashboardsLoaded, setServerDashboardsLoaded] = useState(false);
  const [serverDashboardCount, setServerDashboardCount] = useState<number | null>(
    null
  );
  const [activeDashboardId, setActiveDashboardId] = useState<Id | undefined>();
  const userSelectedRef = useRef(false);
  const pendingRestoreRef = useRef<string | null>(null);

  const lastActiveDashboardKey =
    typeof window === "undefined"
      ? null
      : authEmail
        ? `lifedashboard.lastActiveDashboardId:${authEmail}`
        : `lifedashboard.lastActiveDashboardId:local:${getOrCreateLocalProfileId()}`;

  const setActiveDashboardIdByUser = useCallback((nextId?: Id) => {
    userSelectedRef.current = true;
    pendingRestoreRef.current = null;
    setActiveDashboardId(nextId);
  }, []);

  useEffect(() => {
    if (!dashboards) return;
    if (dashboards.length === 0) {
      setActiveDashboardId(undefined);
      return;
    }
    if (
      activeDashboardId &&
      dashboards.some((dashboard) => dashboard.id === activeDashboardId)
    ) {
      return;
    }
    let nextId: Id | undefined;
    if (lastActiveDashboardKey) {
      const storedId = localStorage.getItem(lastActiveDashboardKey);
      if (storedId && dashboards.some((dashboard) => dashboard.id === storedId)) {
        nextId = storedId;
      }
    }
    setActiveDashboardId(nextId ?? dashboards[0].id);
  }, [dashboards, activeDashboardId, lastActiveDashboardKey]);

  useEffect(() => {
    pendingRestoreRef.current = null;
  }, [lastActiveDashboardKey]);

  useEffect(() => {
    if (!lastActiveDashboardKey) return;
    if (!dashboards?.length) return;
    if (userSelectedRef.current) return;

    const storedId = localStorage.getItem(lastActiveDashboardKey);
    if (!storedId) return;
    if (!dashboards.some((dashboard) => dashboard.id === storedId)) return;
    if (storedId === activeDashboardId) return;

    pendingRestoreRef.current = storedId;
    setActiveDashboardId(storedId);
  }, [lastActiveDashboardKey, dashboards, activeDashboardId]);

  useEffect(() => {
    if (!lastActiveDashboardKey) return;
    if (!activeDashboardId || !dashboards?.length) return;
    if (!dashboards.some((dashboard) => dashboard.id === activeDashboardId)) {
      return;
    }
    if (
      pendingRestoreRef.current &&
      pendingRestoreRef.current !== activeDashboardId
    ) {
      return;
    }
    localStorage.setItem(lastActiveDashboardKey, activeDashboardId);
    pendingRestoreRef.current = null;
  }, [activeDashboardId, dashboards, lastActiveDashboardKey]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isSignedIn) {
      setServerDashboardsLoaded(true);
      setServerDashboardCount(null);
      return;
    }
    let cancelled = false;
    setServerDashboardsLoaded(false);
    setServerDashboardCount(null);
    void (async () => {
      try {
        const response = await fetch("/api/dashboards");
        const payload = await readJson<{
          ok?: boolean;
          dashboards?: Dashboard[];
        }>(response);
        if (cancelled) return;
        if (response.ok && payload?.ok && Array.isArray(payload.dashboards)) {
          await syncDashboardsFromServer(payload.dashboards);
          if (!cancelled) {
            setServerDashboardCount(payload.dashboards.length);
          }
        }
      } finally {
        if (!cancelled) setServerDashboardsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isSignedIn]);

  const { error: dashboardError, isCreating, retry } = useEnsureDashboard(
    dashboards,
    {
      enabled: !isAuthLoading && (!isSignedIn || serverDashboardsLoaded),
      shouldCreate: !isSignedIn || serverDashboardCount === 0,
    }
  );

  return {
    activeDashboardId,
    setActiveDashboardIdByUser,
    dashboardError,
    isCreating,
    retry,
  };
}
