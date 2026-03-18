import { useCallback, useEffect, useMemo, useState } from "react";
import { updateWidgetSettings } from "@/shared/db/db";
import { useWidget } from "@/shared/db/queries";
import { SummaryWeekday, getSummaryWindow, isSummaryWeekday } from "@/feature/widgets/WeeklySummary/libs/window";
import { shouldRetryMissingWidget } from "@/feature/widgets/WeeklySummary/libs/retry";

type SummaryState = {
  isLoading: boolean;
  error: string | null;
  data: {
    status: "ready" | "pending" | "failed";
    windowStartYmd: string;
    windowEndYmd: string;
    summary?: string;
    generatedAt?: string;
    model?: string;
    error?: string;
    stats?: {
      todoTotal: number;
      todoDone: number;
      todoPending: number;
      eventCount: number;
      memoCount: number;
      metricEntryCount: number;
    };
  } | null;
};

const DEFAULT_WEEKDAY: SummaryWeekday = 0;
const EMPTY_SETTINGS: Record<string, unknown> = {};

export function useWeeklySummaryWidget(widgetId: string) {
  const widget = useWidget(widgetId);
  const settings =
    widget?.settings &&
    typeof widget.settings === "object" &&
    !Array.isArray(widget.settings)
      ? (widget.settings as Record<string, unknown>)
      : EMPTY_SETTINGS;
  const summaryWeekday = isSummaryWeekday(settings.summaryWeekday)
    ? settings.summaryWeekday
    : DEFAULT_WEEKDAY;
  const widgetCreatedAt = widget?.createdAt;

  const summaryWindow = useMemo(
    () => getSummaryWindow(summaryWeekday),
    [summaryWeekday]
  );
  const [reloadNonce, setReloadNonce] = useState(0);
  const [summaryState, setSummaryState] = useState<SummaryState>({
    isLoading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    if (!widget?.dashboardId) return;

    let cancelled = false;
    const params = new URLSearchParams({
      windowStartYmd: summaryWindow.windowStartYmd,
      windowEndYmd: summaryWindow.windowEndYmd,
      windowStartAt: summaryWindow.windowStartAt,
      windowEndAt: summaryWindow.windowEndAt,
    });
    const url = `/api/dashboards/${widget.dashboardId}/widgets/${widgetId}/assistant?${params.toString()}`;

    const loadSummary = async () => {
      setSummaryState((current) => ({
        isLoading: true,
        error: null,
        data:
          current.data?.windowStartYmd === summaryWindow.windowStartYmd &&
          current.data?.windowEndYmd === summaryWindow.windowEndYmd
            ? current.data
            : {
                status: "pending",
                windowStartYmd: summaryWindow.windowStartYmd,
                windowEndYmd: summaryWindow.windowEndYmd,
              },
      }));

      try {
        const response = await fetch(url, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; summary?: SummaryState["data"]; error?: string }
          | null;
        if (!response.ok || !payload?.ok || !payload.summary) {
          throw new Error(payload?.error ?? "Failed to load summary");
        }
        if (cancelled) return;
        setSummaryState({
          isLoading: false,
          error: null,
          data: payload.summary,
        });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load summary";
        if (
          shouldRetryMissingWidget({
            errorMessage: message,
            widgetCreatedAt,
          })
        ) {
          setSummaryState({
            isLoading: false,
            error: null,
            data: {
              status: "pending",
              windowStartYmd: summaryWindow.windowStartYmd,
              windowEndYmd: summaryWindow.windowEndYmd,
            },
          });
          return;
        }
        setSummaryState({
          isLoading: false,
          error: message,
          data: null,
        });
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [widget?.dashboardId, widgetCreatedAt, widgetId, summaryWindow, reloadNonce]);

  useEffect(() => {
    if (summaryState.data?.status !== "pending" || summaryState.isLoading) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setReloadNonce((current) => current + 1);
    }, 1500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    summaryState.data?.status,
    summaryState.data?.windowStartYmd,
    summaryState.data?.windowEndYmd,
    summaryState.isLoading,
  ]);

  const setSummaryDay = useCallback(
    async (nextDay: SummaryWeekday) => {
      if (!widget) return;
      if (nextDay === summaryWeekday) return;
      await updateWidgetSettings(widget.id, {
        ...settings,
        summaryWeekday: nextDay,
      });
      setReloadNonce((current) => current + 1);
    },
    [widget, settings, summaryWeekday]
  );

  return {
    widget,
    settings,
    summaryWeekday,
    summaryWindow,
    summaryState,
    reloadSummary: () => setReloadNonce((current) => current + 1),
    setSummaryDay,
  };
}
