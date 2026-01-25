import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { createWidgetLayout } from "@/feature/dashboard/libs/layout";

const MIN_W = 4;
const MIN_H = 8;

export function useAddChartWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined
) {
  return useCallback(async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "chart",
      layout: createWidgetLayout(widgets?.map((w) => w.layout) ?? [], {
        w: MIN_W,
        h: MIN_H,
        minW: MIN_W,
        minH: MIN_H,
      }),
      settings: { isConfigured: false },
      payload: {
        type: "chart",
        data: { name: "지표", unit: undefined, chartType: "line" },
      },
    });
  }, [dashboardId, widgets]);
}
