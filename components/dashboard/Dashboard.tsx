"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";

import { useDashboards, useDashboardWidgets } from "@/db/queries";
import { addWidget, createDashboard, db, nowIso } from "@/db/db";
import type { WidgetLayout } from "@/db/schema";

function defaultMemoLayout(existing: WidgetLayout[]): WidgetLayout {
  // 현재 위젯들 중 가장 아래 y+h 계산
  const bottom =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((l) => (l.y ?? 0) + (l.h ?? 0)));

  return { x: 0, y: bottom, w: 4, h: 4 };
}

export default function Dashboard() {
  const dashboards = useDashboards();
  const [dialogOpen, setDialogOpen] = useState(false);

  // ✅ 대시보드 자동 생성: "처음 로드 + dashboards 로딩 완료 + 0개"일 때만 생성
  useEffect(() => {
    if (!dashboards) return; // 아직 로딩 중
    if (dashboards.length > 0) return;

    void (async () => {
      await createDashboard({ name: "My Dashboard" });
    })();
  }, [dashboards]);

  // v1: 첫 대시보드를 기본 선택
  const dashboardId = useMemo(() => dashboards?.[0]?.id, [dashboards]);

  const widgets = useDashboardWidgets(
    // dashboardId 없을 때는 query가 깨지지 않게 더미값
    dashboardId ?? "__none__"
  );

  const onAddMemo = async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "memo",
      layout: defaultMemoLayout(widgets?.map((w) => w.layout) ?? []),
      payload: { type: "memo", data: { text: "", color: undefined } },
    });

    // DB 구독이므로 setState 필요 없음 → 자동으로 Grid에 나타남
  };

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
          onLayoutChange={async (nextWidgets) => {
            // ✅ 여기서 DB에 저장(= commit)
            const now = nowIso();
            await db.widgets.bulkPut(
              nextWidgets.map((w) => ({ ...w, updatedAt: now }))
            );
          }}
        />
      )}

      <Footer onAddClick={() => setDialogOpen(true)} />

      <AddWidgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(type) => {
          if (type === "memo") void onAddMemo();
        }}
      />
    </div>
  );
}
