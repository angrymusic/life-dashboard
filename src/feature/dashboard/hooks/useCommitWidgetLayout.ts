import { useCallback } from "react";
import { commitWidgetLayout } from "@/shared/db/db";
import type { Widget } from "@/shared/db/schema";

export function useCommitWidgetLayout() {
  return useCallback(async (nextWidgets: Widget[]) => {
    await commitWidgetLayout(nextWidgets);
  }, []);
}
