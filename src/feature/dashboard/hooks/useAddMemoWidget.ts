import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { getNextMemoLayout } from "@/feature/dashboard/libs/layout";

export function useAddMemoWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined
) {
  return useCallback(async () => {
    if (!dashboardId) return;

    await addWidget({
      dashboardId,
      type: "memo",
      layout: getNextMemoLayout(widgets?.map((w) => w.layout) ?? []),
      payload: { type: "memo", data: { text: "", color: undefined } },
    });
  }, [dashboardId, widgets]);
}
