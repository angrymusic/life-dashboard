import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { createWidgetLayout } from "@/feature/dashboard/libs/layout";

const MIN_W = 3;
const MIN_H = 5;

export function useAddWeatherWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined
) {
  return useCallback(async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "weather",
      layout: createWidgetLayout(widgets?.map((w) => w.layout) ?? [], {
        w: MIN_W,
        h: MIN_H,
        minW: MIN_W,
        minH: MIN_H,
      }),
    });
  }, [dashboardId, widgets]);
}
