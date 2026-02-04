import { useCallback, useEffect, useRef, useState } from "react";
import { ensureDefaultDashboard, getOrCreateLocalProfileId } from "@/shared/db/db";
import type { Dashboard } from "@/shared/db/schema";

type EnsureOptions = {
  enabled?: boolean;
};

export function useEnsureDashboard(
  dashboards: Dashboard[] | undefined,
  options: EnsureOptions = {}
) {
  const isCreatingRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (options.enabled === false) return;
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
        await ensureDefaultDashboard({
          name: "My Dashboard",
          ownerId: getOrCreateLocalProfileId(),
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
  }, [dashboards, attempt, options.enabled]);

  return { isCreating, error, retry };
}
