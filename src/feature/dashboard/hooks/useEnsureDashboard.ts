import { useEffect } from "react";
import { createDashboard } from "@/shared/db/db";
import type { Dashboard } from "@/shared/db/schema";

export function useEnsureDashboard(dashboards: Dashboard[] | undefined) {
  useEffect(() => {
    if (!dashboards) return;
    if (dashboards.length > 0) return;

    void (async () => {
      await createDashboard({ name: "My Dashboard" });
    })();
  }, [dashboards]);
}
