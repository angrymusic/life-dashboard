import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { createWidgetLayout } from "@/feature/dashboard/libs/layout";

const MIN_W = 2;
const MIN_H = 5;

export function useAddMoodWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined,
  createdBy?: Id
) {
  return useCallback(async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "mood",
      layout: createWidgetLayout(widgets?.map((w) => w.layout) ?? [], {
        w: MIN_W,
        h: MIN_H,
        minW: MIN_W,
        minH: MIN_H,
      }),
      createdBy,
    });
  }, [dashboardId, widgets, createdBy]);
}
