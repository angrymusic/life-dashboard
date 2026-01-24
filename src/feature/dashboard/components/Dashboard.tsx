"use client";

import { useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";

import { useDashboards, useDashboardWidgets } from "@/shared/db/queries";
import { useEnsureDashboard } from "@/feature/dashboard/hooks/useEnsureDashboard";
import { useAddCalendarWidget } from "@/feature/dashboard/hooks/useAddCalendarWidget";
import { useAddMemoWidget } from "@/feature/dashboard/hooks/useAddMemoWidget";
import { useCommitWidgetLayout } from "@/feature/dashboard/hooks/useCommitWidgetLayout";

export default function Dashboard() {
  const dashboards = useDashboards();
  useEnsureDashboard(dashboards);
  const [dialogOpen, setDialogOpen] = useState(false);

  // v1: 첫 대시보드를 기본 선택
  const dashboardId = dashboards?.[0]?.id;

  const widgets = useDashboardWidgets(
    // dashboardId 없을 때는 query가 깨지지 않게 더미값
    dashboardId ?? "__none__"
  );

  const addCalendarWidget = useAddCalendarWidget(dashboardId, widgets);
  const addMemoWidget = useAddMemoWidget(dashboardId, widgets);
  const commitWidgetLayout = useCommitWidgetLayout();

  return (
    <div>
      <Header />

      {!dashboardId ? (
        <div className="p-6 text-sm text-gray-500">대시보드 생성 중...</div>
      ) : !widgets ? (
        <div className="p-6 text-sm text-gray-400">Loading widgets...</div>
      ) : (
        <GridLayout
          widgets={widgets}
          onLayoutChange={commitWidgetLayout}
        />
      )}

      <Footer onAddClick={() => setDialogOpen(true)} />

      <AddWidgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(type) => {
          if (type === "calendar") void addCalendarWidget();
          if (type === "memo") void addMemoWidget();
        }}
      />
    </div>
  );
}
