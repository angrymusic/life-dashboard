import { useMemo, useState } from "react";
import { CalendarDays, Settings2 } from "lucide-react";
import { useWeeklySummaryWidget } from "@/feature/widgets/WeeklySummary/hooks/useWeeklySummaryWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { SummaryWeekday } from "@/feature/widgets/WeeklySummary/libs/window";
import { useI18n } from "@/shared/i18n/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type WeeklySummaryWidgetProps = {
  widgetId: string;
  canEdit?: boolean;
};

function getWeekdayOptions(t: (ko: string, en: string) => string) {
  return [
    { value: 0 as SummaryWeekday, label: t("일요일", "Sunday") },
    { value: 1 as SummaryWeekday, label: t("월요일", "Monday") },
    { value: 2 as SummaryWeekday, label: t("화요일", "Tuesday") },
    { value: 3 as SummaryWeekday, label: t("수요일", "Wednesday") },
    { value: 4 as SummaryWeekday, label: t("목요일", "Thursday") },
    { value: 5 as SummaryWeekday, label: t("금요일", "Friday") },
    { value: 6 as SummaryWeekday, label: t("토요일", "Saturday") },
  ];
}

function formatRangeLabel(
  windowStartYmd: string,
  windowEndYmd: string,
  locale: string,
) {
  const [startYear, startMonth, startDay] = windowStartYmd
    .split("-")
    .map(Number);
  const [endYear, endMonth, endDay] = windowEndYmd.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  end.setDate(end.getDate() - 1);
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function WeeklySummaryWidget({
  widgetId,
  canEdit = true,
}: WeeklySummaryWidgetProps) {
  const { t, locale } = useI18n();
  const { summaryWeekday, summaryWindow, summaryState, setSummaryDay } =
    useWeeklySummaryWidget(widgetId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const weekdayOptions = useMemo(() => getWeekdayOptions(t), [t]);
  const selectedWeekdayLabel =
    weekdayOptions.find((option) => option.value === summaryWeekday)?.label ??
    weekdayOptions[0].label;
  const summary = summaryState.data;
  const rangeLabel = formatRangeLabel(
    summaryWindow.windowStartYmd,
    summaryWindow.windowEndYmd,
    locale,
  );

  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: t("위젯 삭제", "Delete widget"),
    extraItems: canEdit
      ? [
          {
            text: t("요약 기준 요일", "Summary day"),
            icon: <Settings2 className="size-4" />,
            onClick: () => setSettingsOpen(true),
          },
        ]
      : [],
  });

  return (
    <WidgetCard
      header={
        <WidgetHeader
          left={
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">
                {t("주간 요약", "Weekly Summary")}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {t("매주", "Every")} {selectedWeekdayLabel}
              </div>
            </div>
          }
          actions={actions}
          canEdit={canEdit}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <div className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">
              {rangeLabel ??
                t(
                  "요약 범위를 계산하는 중...",
                  "Calculating summary window...",
                )}
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-gray-200/70 px-2 py-1 text-[11px] text-gray-500 dark:border-gray-700">
            {selectedWeekdayLabel}
          </span>
        </div>

        <div className="rounded-md border border-gray-200/70 p-3 dark:border-gray-700">
          <div className="min-h-[5rem] text-sm leading-6 text-gray-700 dark:text-gray-200">
            {summaryState.isLoading ? (
              <div>
                {t("주간 요약을 불러오는 중...", "Loading weekly summary...")}
              </div>
            ) : summaryState.error ? (
              <div className="text-rose-600 dark:text-rose-300">
                {summaryState.error}
              </div>
            ) : summary?.status === "pending" ? (
              <div>
                {t(
                  "이번 주 요약을 만드는 중입니다...",
                  "Generating this week's summary...",
                )}
              </div>
            ) : summary?.status === "failed" ? (
              <div className="text-rose-600 dark:text-rose-300">
                {summary.error ??
                  t("요약 생성에 실패했습니다.", "Failed to generate summary.")}
              </div>
            ) : summary?.summary ? (
              <div>{summary.summary}</div>
            ) : (
              <div className="text-gray-400">
                {t(
                  "아직 생성된 요약이 없습니다.",
                  "No summary has been generated yet.",
                )}
              </div>
            )}
          </div>
          {summary?.stats ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500 @sm:grid-cols-4">
              <div className="rounded-md border border-gray-200/70 px-2 py-1.5 dark:border-gray-700">
                <div>{t("할 일", "Todo")}</div>
                <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {summary.stats.todoDone}/{summary.stats.todoTotal}
                </div>
              </div>
              <div className="rounded-md border border-gray-200/70 px-2 py-1.5 dark:border-gray-700">
                <div>{t("남은 일", "Open")}</div>
                <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {summary.stats.todoPending}
                </div>
              </div>
              <div className="rounded-md border border-gray-200/70 px-2 py-1.5 dark:border-gray-700">
                <div>{t("일정", "Events")}</div>
                <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {summary.stats.eventCount}
                </div>
              </div>
              <div className="rounded-md border border-gray-200/70 px-2 py-1.5 dark:border-gray-700">
                <div>{t("메모", "Memos")}</div>
                <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {summary.stats.memoCount}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("요약 기준 요일", "Summary day")}</DialogTitle>
              <DialogDescription>
                {t(
                  "선택한 요일이 시작되면 직전 7일 요약을 한 번 생성합니다.",
                  "When the selected day starts, the widget generates one summary for the previous 7 days.",
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <label className="text-[11px] text-gray-400">
                {t("요일", "Weekday")}
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                value={String(summaryWeekday)}
                onChange={(event) => {
                  void setSummaryDay(
                    Number(event.target.value) as SummaryWeekday,
                  );
                }}
                disabled={!canEdit}
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(false)}
              >
                {t("닫기", "Close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("주간 요약", "Weekly Summary")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
