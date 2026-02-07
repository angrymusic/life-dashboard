import { useCallback } from "react";
import {
  createDashboard as createDashboardRecord,
  deleteDashboardCascade,
  getOrCreateLocalProfileId,
  updateDashboardName,
} from "@/shared/db/db";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import { useAddWidget } from "@/feature/dashboard/hooks/useAddWidget";
import { useCommitWidgetLayout } from "@/feature/dashboard/hooks/useCommitWidgetLayout";

type ActionsParams = {
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  setActiveDashboardIdByUser: (nextId?: Id) => void;
  dashboardId?: Id;
  widgets?: Widget[];
  widgetCreatorId?: Id;
};

type ActionsResult = {
  addWidget: ReturnType<typeof useAddWidget>;
  commitWidgetLayout: ReturnType<typeof useCommitWidgetLayout>;
  createDashboard: (name: string) => Promise<void>;
  renameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  deleteDashboard: (dashboardId: Id) => Promise<void>;
};

export function useDashboardActions({
  dashboards,
  activeDashboardId,
  setActiveDashboardIdByUser,
  dashboardId,
  widgets,
  widgetCreatorId,
}: ActionsParams): ActionsResult {
  const addWidget = useAddWidget(dashboardId, widgets, widgetCreatorId);
  const commitWidgetLayout = useCommitWidgetLayout();

  const createDashboard = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const ownerId = getOrCreateLocalProfileId();
      const createdId = await createDashboardRecord({
        name: trimmed,
        ownerId,
      });
      setActiveDashboardIdByUser(createdId);
    },
    [setActiveDashboardIdByUser]
  );

  const renameDashboard = useCallback(async (targetId: Id, name: string) => {
    await updateDashboardName(targetId, name);
  }, []);

  const deleteDashboard = useCallback(
    async (targetId: Id) => {
      await deleteDashboardCascade(targetId);
      if (targetId !== activeDashboardId) return;
      const remaining =
        dashboards?.filter((dashboard) => dashboard.id !== targetId) ?? [];
      setActiveDashboardIdByUser(remaining[0]?.id);
    },
    [activeDashboardId, dashboards, setActiveDashboardIdByUser]
  );

  return {
    addWidget,
    commitWidgetLayout,
    createDashboard,
    renameDashboard,
    deleteDashboard,
  };
}
