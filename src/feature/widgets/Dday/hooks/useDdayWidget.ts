import { useCallback, useMemo } from "react";
import {
  addDday,
  deleteDdaysByIds,
  deleteDdaysByWidget,
  updateDday,
} from "@/shared/db/db";
import { useDdays, useWidget } from "@/shared/db/queries";
import type { Dday, Id, YMD } from "@/shared/db/schema";

type SaveDdayInput = {
  title: string;
  date: YMD;
  color?: string;
};

export function useDdayWidget(widgetId: Id) {
  const widget = useWidget(widgetId);
  const ddays = useDdays(widgetId);

  const dday = useMemo((): Dday | null => {
    const list = ddays ?? [];
    if (!list.length) return null;

    return [...list].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )[0];
  }, [ddays]);

  const saveDday = useCallback(
    async (input: SaveDdayInput) => {
      if (!widget) return;
      const trimmed = input.title.trim();
      if (!trimmed || !input.date) return;

      let keepId = dday?.id ?? null;

      if (dday) {
        await updateDday(dday, {
          title: trimmed,
          date: input.date,
          color: input.color,
        });
      } else {
        keepId = await addDday({
          widgetId,
          dashboardId: widget.dashboardId,
          title: trimmed,
          date: input.date,
          color: input.color,
        });
      }

      const extraIds =
        keepId && ddays
          ? ddays.filter((item) => item.id !== keepId).map((item) => item.id)
          : [];

      if (extraIds.length) {
        await deleteDdaysByIds(extraIds);
      }
    },
    [widget, widgetId, dday, ddays]
  );

  const deleteDday = useCallback(async () => {
    await deleteDdaysByWidget(widgetId);
  }, [widgetId]);

  return {
    widget,
    dday,
    saveDday,
    deleteDday,
  };
}
