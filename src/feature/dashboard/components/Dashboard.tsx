"use client";

import { useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";

import { useDashboards, useDashboardWidgets } from "@/shared/db/queries";
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

export default function Dashboard() {
  const dashboards = useDashboards();
  const { error: dashboardError, isCreating, retry } =
    useEnsureDashboard(dashboards);
  const [dialogOpen, setDialogOpen] = useState(false);

  // v1: 첫 대시보드를 기본 선택
  const dashboardId = dashboards?.[0]?.id;

  const widgets = useDashboardWidgets(dashboardId);

  const addCalendarWidget = useAddCalendarWidget(dashboardId, widgets);
  const addChartWidget = useAddChartWidget(dashboardId, widgets);
  const addDdayWidget = useAddDdayWidget(dashboardId, widgets);
  const addMoodWidget = useAddMoodWidget(dashboardId, widgets);
  const addMemoWidget = useAddMemoWidget(dashboardId, widgets);
  const addPhotoWidget = useAddPhotoWidget(dashboardId, widgets);
  const addTodoWidget = useAddTodoWidget(dashboardId, widgets);
  const addWeatherWidget = useAddWeatherWidget(dashboardId, widgets);
  const commitWidgetLayout = useCommitWidgetLayout();

  return (
    <div>
      <Header />

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
        />
      )}

      <Footer onAddClick={() => setDialogOpen(true)} />

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
      />
    </div>
  );
}
