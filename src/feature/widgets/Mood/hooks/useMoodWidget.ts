import { useCallback, useMemo } from "react";
import { db, newId, nowIso } from "@/shared/db/db";
import { useMoodsByDate, useWidget } from "@/shared/db/queries";
import type { Id, Mood, YMD } from "@/shared/db/schema";

function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

export function useMoodWidget(widgetId: Id) {
  const widget = useWidget(widgetId);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const moods = useMoodsByDate(widgetId, todayYmd);

  const mood = useMemo((): Mood | null => {
    const list = moods ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [moods]);

  const setMood = useCallback(
    async (value: Mood["mood"]) => {
      if (!widget) return;
      const now = nowIso();
      const list = moods ?? [];
      let keepId = mood?.id ?? null;

      if (mood) {
        if (mood.mood !== value) {
          await db.moods.update(mood.id, {
            mood: value,
            date: todayYmd,
            updatedAt: now,
          });
        }
      } else {
        keepId = newId();
        await db.moods.add({
          id: keepId,
          widgetId,
          dashboardId: widget.dashboardId,
          date: todayYmd,
          mood: value,
          createdAt: now,
          updatedAt: now,
        });
      }

      const extraIds = keepId
        ? list.filter((item) => item.id !== keepId).map((item) => item.id)
        : [];

      if (extraIds.length) {
        await db.moods.bulkDelete(extraIds);
      }
    },
    [widget, widgetId, todayYmd, mood, moods]
  );

  return {
    mood,
    todayYmd,
    setMood,
  };
}
