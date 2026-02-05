"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";

import {
  applyDashboardSnapshot,
  createDashboard,
  deleteDashboardCascade,
  flushOutbox,
  getOrCreateLocalProfileId,
  removeSharedDashboardLocally,
  updateDashboardName,
  syncDashboardsFromServer,
} from "@/shared/db/db";
import { useDashboards, useDashboardWidgets, useMembers, useOutboxCount } from "@/shared/db/queries";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import { useEnsureDashboard } from "@/feature/dashboard/hooks/useEnsureDashboard";
import { useAddCalendarWidget } from "@/feature/dashboard/hooks/useAddCalendarWidget";
import { useAddChartWidget } from "@/feature/dashboard/hooks/useAddChartWidget";
import { useAddDdayWidget } from "@/feature/dashboard/hooks/useAddDdayWidget";
import { useAddMoodWidget } from "@/feature/dashboard/hooks/useAddMoodWidget";
import { useAddMemoWidget } from "@/feature/dashboard/hooks/useAddMemoWidget";
import { useAddPhotoWidget } from "@/feature/dashboard/hooks/useAddPhotoWidget";
import { useAddTodoWidget } from "@/feature/dashboard/hooks/useAddTodoWidget";
import { useAddWeatherWidget } from "@/feature/dashboard/hooks/useAddWeatherWidget";
import { useCommitWidgetLayout } from "@/feature/dashboard/hooks/useCommitWidgetLayout";
import { Button } from "@/shared/ui/button";
import { useSession } from "next-auth/react";

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const dashboards = useDashboards();
  const { data: session, status: authStatus } = useSession();
  const isSignedIn = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";
  const [serverDashboardsLoaded, setServerDashboardsLoaded] = useState(false);
  const [serverDashboardCount, setServerDashboardCount] = useState<number | null>(
    null
  );
  const authEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const lastActiveDashboardKey =
    typeof window === "undefined"
      ? null
      : authEmail
        ? `lifedashboard.lastActiveDashboardId:${authEmail}`
        : `lifedashboard.lastActiveDashboardId:local:${getOrCreateLocalProfileId()}`;
  const { error: dashboardError, isCreating, retry } = useEnsureDashboard(
    dashboards,
    {
      enabled: !isAuthLoading && (!isSignedIn || serverDashboardsLoaded),
      shouldCreate: !isSignedIn || serverDashboardCount === 0,
    }
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState<Id | undefined>();
  const userSelectedRef = useRef(false);
  const pendingRestoreRef = useRef<string | null>(null);
  const outboxCount = useOutboxCount();
  const members = useMembers();
  const flushRef = useRef(false);

  const setActiveDashboardIdByUser = (nextId?: Id) => {
    userSelectedRef.current = true;
    pendingRestoreRef.current = null;
    setActiveDashboardId(nextId);
  };

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

  const dashboardId = activeDashboardId;
  const activeDashboard = dashboards?.find(
    (dashboard) => dashboard.id === dashboardId
  );
  const currentMember = useMemo(() => {
    if (!activeDashboard?.groupId || !members || !authEmail) return undefined;
    return members.find(
      (member) =>
        member.groupId === activeDashboard.groupId &&
        member.email?.trim().toLowerCase() === authEmail
    );
  }, [activeDashboard?.groupId, members, authEmail]);
  const isAdmin = !activeDashboard?.groupId || currentMember?.role === "parent";
  const currentUserId = currentMember?.userId ?? undefined;
  const canCreateWidget = !activeDashboard?.groupId
    ? true
    : Boolean(isSignedIn && currentMember);
  const canEditWidget = useCallback(
    (widget: Widget) => {
      if (!activeDashboard?.groupId) return true;
      if (!isSignedIn) return false;
      if (isAdmin) return true;
      if (!currentUserId) return false;
      return widget.createdBy === currentUserId;
    },
    [activeDashboard?.groupId, isSignedIn, isAdmin, currentUserId]
  );

  const widgets = useDashboardWidgets(dashboardId);

  const widgetCreatorId = activeDashboard?.groupId ? currentUserId : undefined;
  const addCalendarWidget = useAddCalendarWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addChartWidget = useAddChartWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addDdayWidget = useAddDdayWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addMoodWidget = useAddMoodWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addMemoWidget = useAddMemoWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addPhotoWidget = useAddPhotoWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addTodoWidget = useAddTodoWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const addWeatherWidget = useAddWeatherWidget(
    dashboardId,
    widgets,
    widgetCreatorId
  );
  const commitWidgetLayout = useCommitWidgetLayout();

  useEffect(() => {
    if (!activeDashboard?.groupId) return;
    if (!isSignedIn) return;

    let cancelled = false;
    void (async () => {
      const response = await fetch(
        `/api/dashboards/${activeDashboard.id}/snapshot`
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
      if (cancelled) return;
      if (response.status === 403 || response.status === 404) {
        await removeSharedDashboardLocally(
          activeDashboard.id,
          activeDashboard.groupId
        );
        return;
      }
      if (!response.ok || !payload?.ok || !payload.dashboard) return;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDashboard?.id, activeDashboard?.groupId, isSignedIn]);

  useEffect(() => {
    if (!dashboardId) return;
    if (activeDashboard?.groupId) return;
    if (!isSignedIn) return;
    if (widgets === undefined || widgets.length > 0) return;

    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/dashboards/${dashboardId}/snapshot`);
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
      if (cancelled) return;
      if (!response.ok || !payload?.ok || !payload.dashboard) return;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [dashboardId, activeDashboard?.groupId, isSignedIn, widgets]);

  useEffect(() => {
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
  }, [isSignedIn, outboxCount]);

  return (
    <div>
      <Header
        dashboards={dashboards}
        activeDashboardId={dashboardId}
        onSelectDashboard={setActiveDashboardIdByUser}
        onCreateDashboard={async (name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          const ownerId = getOrCreateLocalProfileId();
          const createdId = await createDashboard({
            name: trimmed,
            ownerId,
          });
          setActiveDashboardIdByUser(createdId);
        }}
        onRenameDashboard={async (targetId, name) => {
          await updateDashboardName(targetId, name);
        }}
        onDeleteDashboard={async (targetId) => {
          await deleteDashboardCascade(targetId);
          if (targetId !== activeDashboardId) return;
          const remaining =
            dashboards?.filter((dashboard) => dashboard.id !== targetId) ?? [];
          setActiveDashboardIdByUser(remaining[0]?.id);
        }}
      />

      {activeDashboard?.groupId && !isSignedIn ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          공유 대시보드는 로그인 후 편집할 수 있어요.
        </div>
      ) : null}

      {!dashboardId ? (
        <div className="p-6 text-sm">
          {dashboardError ? (
            <div className="space-y-3 text-red-600">
              <div>대시보드를 생성하지 못했어요.</div>
              <Button variant="outline" size="sm" onClick={retry}>
                다시 시도
              </Button>
            </div>
          ) : (
            <div className="text-gray-500">
              {isCreating
                ? "대시보드 생성 중..."
                : "대시보드를 불러오는 중..."}
            </div>
          )}
        </div>
      ) : !widgets ? (
        <div className="p-6 text-sm text-gray-400">Loading widgets...</div>
      ) : (
        <GridLayout
          widgets={widgets}
          onLayoutCommit={commitWidgetLayout}
          canEditWidget={canEditWidget}
        />
      )}

      <Footer onAddClick={() => setDialogOpen(true)} canEdit={canCreateWidget} />

      <AddWidgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(type) => {
          if (type === "calendar") void addCalendarWidget();
          if (type === "chart") void addChartWidget();
          if (type === "dday") void addDdayWidget();
          if (type === "mood") void addMoodWidget();
          if (type === "memo") void addMemoWidget();
          if (type === "photo") void addPhotoWidget();
          if (type === "todo") void addTodoWidget();
          if (type === "weather") void addWeatherWidget();
        }}
        disabled={!canCreateWidget}
      />
    </div>
  );
}
