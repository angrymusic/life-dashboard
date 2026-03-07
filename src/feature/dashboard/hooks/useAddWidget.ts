import { useCallback } from "react";
import { addWidget } from "@/shared/db/db";
import type { Id, Widget } from "@/shared/db/schema";
import {
  WidgetRegistry,
  type AddableWidgetType,
} from "@/feature/dashboard/libs/widgetRegistry";
import { useI18n } from "@/shared/i18n/client";

export function useAddWidget(
  dashboardId: Id | undefined,
  widgets: Widget[] | undefined,
  createdBy?: Id
) {
  const { language } = useI18n();

  return useCallback(
    async (type: AddableWidgetType) => {
      if (!dashboardId) return;

      const { layout, settings, payload } = WidgetRegistry[type].create({
        existingLayouts: widgets?.map((w) => w.layout) ?? [],
        language,
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
    [dashboardId, widgets, createdBy, language]
  );
}
