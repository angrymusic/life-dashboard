import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { createWidgetLayout } from "@/feature/dashboard/libs/layout";

const MIN_W = 3;
const MIN_H = 4;
export function useAddMemoWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined,
  createdBy?: Id
) {
  return useCallback(async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "memo",
      layout: createWidgetLayout(widgets?.map((w) => w.layout) ?? [], {
        w: MIN_W,
        h: MIN_H,
        minW: MIN_W,
        minH: MIN_H,
      }),
      createdBy,
      payload: { type: "memo", data: { text: "", color: undefined } },
    });
  }, [dashboardId, widgets, createdBy]);
}
