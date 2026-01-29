import { useCallback } from "react";
import { db, nowIso } from "@/shared/db/db";
import type { Widget } from "@/shared/db/schema";

export function useCommitWidgetLayout() {
  return useCallback(async (nextWidgets: Widget[]) => {
    if (nextWidgets.length === 0) return;
    const now = nowIso();
    await db.widgets.bulkPut(
      nextWidgets.map((w) => ({ ...w, updatedAt: now }))
    );
  }, []);
}
