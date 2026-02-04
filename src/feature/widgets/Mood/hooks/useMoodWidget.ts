import { useCallback, useMemo } from "react";
import { addMood, deleteMoodsByIds, updateMood } from "@/shared/db/db";
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
      const list = moods ?? [];
      let keepId = mood?.id ?? null;

      if (mood) {
        if (mood.mood !== value) {
          await updateMood(mood, {
            mood: value,
            date: todayYmd,
            note: mood.note,
          });
        }
      } else {
        keepId = await addMood({
          widgetId,
          dashboardId: widget.dashboardId,
          date: todayYmd,
          mood: value,
        });
      }

      const extraIds = keepId
        ? list.filter((item) => item.id !== keepId).map((item) => item.id)
        : [];

      if (extraIds.length) {
        await deleteMoodsByIds(extraIds);
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
