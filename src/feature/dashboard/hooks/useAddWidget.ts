import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import { WidgetRegistry } from "@/feature/dashboard/libs/widgetRegistry";
import type { AddableWidgetType } from "@/feature/dashboard/libs/widgetOptions";

export function useAddWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined,
  createdBy?: Id
) {
  return useCallback(
    async (type: AddableWidgetType) => {
      if (!dashboardId) return;

      const { layout, settings, payload } = WidgetRegistry[type].create({
        existingLayouts: widgets?.map((w) => w.layout) ?? [],
      });

      await addWidget({
        dashboardId,
        type,
        layout,
        settings,
        payload,
        createdBy,
      });
    },
    [dashboardId, widgets, createdBy]
  );
}
