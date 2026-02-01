import { useCallback, useEffect, useRef, useState } from "react";
import { createDashboard, db, getOrCreateLocalProfileId } from "@/shared/db/db";
import type { Dashboard } from "@/shared/db/schema";

export function useEnsureDashboard(dashboards: Dashboard[] | undefined) {
  const isCreatingRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!dashboards) return;
    if (dashboards.length > 0) {
      setError(null);
      return;
    }
    if (isCreatingRef.current) return;

    isCreatingRef.current = true;
    setIsCreating(true);

    void (async () => {
      try {
        await db.transaction("rw", db.dashboards, async () => {
          const count = await db.dashboards.count();
          if (count > 0) return;
          await createDashboard({
            name: "My Dashboard",
            ownerId: getOrCreateLocalProfileId(),
          });
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "대시보드를 생성하지 못했어요.";
        setError(message);
      } finally {
        isCreatingRef.current = false;
        setIsCreating(false);
      }
    })();
  }, [dashboards, attempt]);

  return { isCreating, error, retry };
}
