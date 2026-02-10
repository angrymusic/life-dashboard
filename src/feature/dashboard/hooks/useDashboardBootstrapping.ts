import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOrCreateLocalProfileId,
  removeDefaultDraftDashboardForSignedInUser,
  syncDashboardsFromServer,
} from "@/shared/db/db";
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
  isServerBootstrapReady: boolean;
  retry: () => void;
  refreshDashboards: () => Promise<void>;
  isRefreshingDashboards: boolean;
};

type DashboardListResponse = {
  ok?: boolean;
  dashboards?: Dashboard[];
  error?: string;
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
  const [isRefreshingDashboards, setIsRefreshingDashboards] = useState(false);
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

  const fetchAndSyncDashboards = useCallback(async () => {
    const response = await fetch("/api/dashboards", { cache: "no-store" });
    const payload = await readJson<DashboardListResponse>(response);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.dashboards)) {
      const message =
        typeof payload?.error === "string" && payload.error
          ? payload.error
          : "대시보드를 불러오지 못했어요.";
      throw new Error(message);
    }

    await removeDefaultDraftDashboardForSignedInUser({
      ownerId: getOrCreateLocalProfileId(),
      serverDashboards: payload.dashboards,
    });
    await syncDashboardsFromServer(payload.dashboards);

    return payload.dashboards.length;
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
        const count = await fetchAndSyncDashboards();
        if (!cancelled) {
          setServerDashboardCount(count);
        }
      } catch {
        // 초기 부트스트랩 실패 시에도 대시보드 생성 플로우가 막히지 않게 로딩만 종료한다.
      } finally {
        if (!cancelled) setServerDashboardsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchAndSyncDashboards, isAuthLoading, isSignedIn]);

  const refreshDashboards = useCallback(async () => {
    if (isAuthLoading || !isSignedIn) return;

    const startedAt = Date.now();
    setIsRefreshingDashboards(true);
    try {
      const count = await fetchAndSyncDashboards();
      setServerDashboardCount(count);
      setServerDashboardsLoaded(true);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = 1000 - elapsed;
      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remaining);
        });
      }
      setIsRefreshingDashboards(false);
    }
  }, [fetchAndSyncDashboards, isAuthLoading, isSignedIn]);

  const { error: dashboardError, isCreating, retry } = useEnsureDashboard(
    dashboards,
    {
      enabled: !isAuthLoading && (!isSignedIn || serverDashboardsLoaded),
      shouldCreate: !isSignedIn || serverDashboardCount === 0,
    }
  );

  const isServerBootstrapReady = !isSignedIn || serverDashboardsLoaded;

  return {
    activeDashboardId,
    setActiveDashboardIdByUser,
    dashboardError,
    isCreating,
    isServerBootstrapReady,
    retry,
    refreshDashboards,
    isRefreshingDashboards,
  };
}
