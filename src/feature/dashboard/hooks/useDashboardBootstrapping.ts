import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLocalDataExceptMigrationState,
  getOrCreateLocalProfileId,
  removeDefaultDraftDashboardForSignedInUser,
  syncDashboardsFromServer,
} from "@/shared/db/db";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useEnsureDashboard } from "@/feature/dashboard/hooks/useEnsureDashboard";
import { getLastActiveDashboardStorageKey } from "@/feature/dashboard/libs/activeDashboardStorage";
import { readJson } from "@/feature/dashboard/libs/readJson";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";
import { clearManagedOfflineCaches } from "@/shared/lib/offlineCaches";
import {
  clearPendingSignOutDataPolicy,
  getPendingSignOutDataPolicy,
  getKeepOfflineDataOnSessionEnd,
} from "@/shared/lib/offlineDataRetention";

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

const AUTHENTICATED_CACHE_MARKER_KEY = "lifedashboard.authenticatedSession";
const SESSION_CLEANUP_DELAY_MS = 500;

export function useDashboardBootstrapping({
  dashboards,
  authEmail,
  isSignedIn,
  isAuthLoading,
}: BootstrappingParams): BootstrappingResult {
  const { t } = useI18n();
  const [serverDashboardsLoaded, setServerDashboardsLoaded] = useState(false);
  const [serverDashboardCount, setServerDashboardCount] = useState<number | null>(
    null
  );
  const [isRefreshingDashboards, setIsRefreshingDashboards] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState<Id | undefined>();
  const userSelectedRef = useRef(false);
  const pendingRestoreRef = useRef<string | null>(null);
  const sessionCleanupInFlightRef = useRef(false);
  const sessionCleanupTaskIdRef = useRef(0);
  const authStateRef = useRef({ isSignedIn, isAuthLoading });

  useEffect(() => {
    authStateRef.current = { isSignedIn, isAuthLoading };
  }, [isAuthLoading, isSignedIn]);

  const lastActiveDashboardKey =
    typeof window === "undefined"
      ? null
      : getLastActiveDashboardStorageKey(authEmail);

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
          ? localizeErrorMessage(payload.error, t)
          : t("대시보드를 불러오지 못했어요.", "Failed to load dashboards.");
      throw new Error(message);
    }

    await removeDefaultDraftDashboardForSignedInUser({
      ownerId: getOrCreateLocalProfileId(),
      serverDashboards: payload.dashboards,
    });
    await syncDashboardsFromServer(payload.dashboards);

    return payload.dashboards.length;
  }, [t]);

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
    if (typeof window === "undefined") return;

    const taskId = ++sessionCleanupTaskIdRef.current;

    if (isSignedIn) {
      localStorage.setItem(AUTHENTICATED_CACHE_MARKER_KEY, "1");
      clearPendingSignOutDataPolicy();
      return;
    }

    if (sessionCleanupInFlightRef.current) return;

    const hasAuthenticatedMarker =
      localStorage.getItem(AUTHENTICATED_CACHE_MARKER_KEY) === "1";

    let hasProtectedDashboards = false;
    if (dashboards?.length) {
      const localProfileId = getOrCreateLocalProfileId();
      hasProtectedDashboards = dashboards.some(
        (dashboard) =>
          Boolean(dashboard.groupId) ||
          (Boolean(dashboard.ownerId) && dashboard.ownerId !== localProfileId)
      );
    }

    const pendingSignOutDataPolicy = getPendingSignOutDataPolicy();

    if (!hasAuthenticatedMarker && !hasProtectedDashboards) {
      if (pendingSignOutDataPolicy) {
        clearPendingSignOutDataPolicy();
      }
      return;
    }

    if (pendingSignOutDataPolicy === "keep") return;

    const shouldKeepOfflineData =
      getKeepOfflineDataOnSessionEnd() && pendingSignOutDataPolicy !== "clear";
    if (shouldKeepOfflineData) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (sessionCleanupTaskIdRef.current !== taskId) return;
      if (
        authStateRef.current.isAuthLoading ||
        authStateRef.current.isSignedIn
      ) {
        return;
      }

      sessionCleanupInFlightRef.current = true;
      void (async () => {
        try {
          await clearLocalDataExceptMigrationState();
          await clearManagedOfflineCaches();
          if (sessionCleanupTaskIdRef.current !== taskId) {
            return;
          }
          if (
            authStateRef.current.isAuthLoading ||
            authStateRef.current.isSignedIn
          ) {
            return;
          }

          const keysToRemove = Object.keys(localStorage).filter((key) =>
            key.startsWith("lifedashboard.")
          );
          keysToRemove.forEach((key) => localStorage.removeItem(key));
          clearPendingSignOutDataPolicy();
          userSelectedRef.current = false;
          pendingRestoreRef.current = null;
          setActiveDashboardId(undefined);
        } finally {
          sessionCleanupInFlightRef.current = false;
        }
      })();
    }, SESSION_CLEANUP_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [dashboards, isAuthLoading, isSignedIn]);

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
        // Even when initial bootstrap fails, finish loading to keep creation flow available.
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
