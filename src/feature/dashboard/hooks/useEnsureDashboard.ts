import { useEffect, useRef } from "react";
import { createDashboard, db } from "@/shared/db/db";
import type { Dashboard } from "@/shared/db/schema";

export function useEnsureDashboard(dashboards: Dashboard[] | undefined) {
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (!dashboards) return;
    if (dashboards.length > 0) return;
    if (isCreatingRef.current) return;

    isCreatingRef.current = true;

    void (async () => {
      try {
        await db.transaction("rw", db.dashboards, async () => {
          const count = await db.dashboards.count();
          if (count > 0) return;
          await createDashboard({ name: "My Dashboard" });
        });
      } finally {
        isCreatingRef.current = false;
      }
    })();
  }, [dashboards]);
}
