import { useCallback, useEffect, useRef, useState } from "react";
import { ensureDefaultDashboard, getOrCreateLocalProfileId } from "@/shared/db/db";
import type { Dashboard } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";

type EnsureOptions = {
  enabled?: boolean;
  shouldCreate?: boolean;
  skipOutbox?: boolean;
};

export function useEnsureDashboard(
  dashboards: Dashboard[] | undefined,
  options: EnsureOptions = {}
) {
  const { t } = useI18n();
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
    if (options.shouldCreate === false) return;
    if (isCreatingRef.current) return;

    isCreatingRef.current = true;
    setIsCreating(true);

    void (async () => {
      try {
        await ensureDefaultDashboard({
          name: "My Dashboard",
          ownerId: getOrCreateLocalProfileId(),
        }, {
          skipOutbox: options.skipOutbox,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? localizeErrorMessage(err.message, t)
            : t("대시보드를 생성하지 못했어요.", "Failed to create dashboard.");
        setError(message);
      } finally {
        isCreatingRef.current = false;
        setIsCreating(false);
      }
    })();
  }, [
    dashboards,
    attempt,
    options.enabled,
    options.shouldCreate,
    options.skipOutbox,
    t,
  ]);

  return { isCreating, error, retry };
}
