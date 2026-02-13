import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { updateWidgetSettings } from "@/shared/db/db";
import type { Id, YMD } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useDdayWidget } from "@/feature/widgets/Dday/hooks/useDdayWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { useI18n } from "@/shared/i18n/client";

const MS_DAY = 24 * 60 * 60 * 1000;

function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

function formatYmd(ymd: string, locale: string) {
  const [yyyy, mm, dd] = ymd.split("-");
  if (!yyyy || !mm || !dd) return ymd;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toUtcDay(ymd: string) {
  const [yyyy, mm, dd] = ymd.split("-").map(Number);
  if (!yyyy || !mm || !dd) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function diffDays(ymd: string) {
  const target = toUtcDay(ymd);
  if (target === null) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / MS_DAY);
}

type DdayWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function DdayWidget({ widgetId, canEdit = true }: DdayWidgetProps) {
  const { t, locale } = useI18n();
  const { widget, dday, saveDday, deleteDday } = useDdayWidget(widgetId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState<YMD>(() => toYmd(new Date()));

  const widgetSettings = useMemo(() => {
    const settings = widget?.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings))
      return {};
    return settings as Record<string, unknown>;
  }, [widget?.settings]);
  const countFromOne = useMemo(() => {
    const value = widgetSettings.countFromOne;
    return typeof value === "boolean" ? value : true;
  }, [widgetSettings]);

  const openDialog = useCallback(() => {
    if (!canEdit) return;
    setDraftTitle(dday?.title ?? "");
    setDraftDate(dday?.date ?? toYmd(new Date()));
    setDialogOpen(true);
  }, [canEdit, dday]);

  const toggleCountFromOne = useCallback(async () => {
    if (!widget) return;
    await updateWidgetSettings(widget.id, {
      ...widgetSettings,
      countFromOne: !countFromOne,
    });
  }, [widget, widgetSettings, countFromOne]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canEdit) return;
      const title = draftTitle.trim();
      if (!title || !draftDate) return;

      await saveDday({ title, date: draftDate });
      setDialogOpen(false);
    },
    [canEdit, draftTitle, draftDate, saveDday]
  );

  const handleRemove = useCallback(async () => {
    await deleteDday();
    setDialogOpen(false);
  }, [deleteDday]);

  const actionLabel = dday ? t("수정", "Edit") : t("추가", "Add");
  const actionIcon = dday ? <Pencil /> : <Plus />;
  const countFromOneLabel = t("시작일 1일 계산", "Start day as Day 1");

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
    extraItems: [
      {
        text: countFromOneLabel,
        toggle: true,
        checked: countFromOne,
        onClick: toggleCountFromOne,
      },
      {
        text: actionLabel,
        icon: actionIcon,
        onClick: openDialog,
      },
    ],
  });

  const diff = dday ? diffDays(dday.date) : null;
  const displayDays =
    diff === null
      ? null
      : countFromOne && diff <= 0
      ? Math.abs(diff) + 1
      : Math.abs(diff);
  const ddayLabel =
    diff === null || displayDays === null
      ? "D--"
      : diff > 0
      ? `D-${displayDays}`
      : diff === 0 && !countFromOne
      ? "D-DAY"
      : `D+${displayDays}`;
  const statusLabel =
    diff === null
      ? t("날짜를 확인해주세요", "Please check the date")
      : diff === 0
      ? t("오늘", "Today")
      : diff > 0
      ? t("남은 날", "Days left")
      : t("지난 날", "Days passed");
  const tone =
    diff === null
      ? "text-gray-400"
      : diff === 0
      ? "text-emerald-600 dark:text-emerald-400"
      : diff > 0
      ? "text-blue-600 dark:text-blue-400"
      : "text-rose-600 dark:text-rose-400";

  const submitLabel = dday ? t("저장", "Save") : t("추가", "Add");
  const canSubmit = draftTitle.trim().length > 0 && Boolean(draftDate);

  const content = useMemo(() => {
    if (!dday) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          {t("추가해주세요", "Add one")}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {dday.title}
            </div>
          </div>
          <span className="text-xs text-gray-400">{formatYmd(dday.date, locale)}</span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl border border-gray-200/70 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/30">
              <div className={cn("text-4xl font-bold leading-none", tone)}>
                {ddayLabel}
              </div>
              <div className="mt-1 text-xs text-gray-500">{statusLabel}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [dday, ddayLabel, locale, statusLabel, t, tone]);

  return (
    <WidgetCard
      header={
        <WidgetHeader title={t("디데이", "D-Day")} actions={actions} canEdit={canEdit} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-1 min-h-0">{content}</div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setDialogOpen(false);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {dday ? t("디데이 설정", "D-Day settings") : t("디데이 추가", "Add D-Day")}
              </DialogTitle>
              <DialogDescription>
                {t("제목과 날짜를 입력해주세요.", "Enter a title and date.")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div>
                <label className="text-[11px] text-gray-400">{t("제목", "Title")}</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder={t("예: 프로젝트 마감", "e.g., Project deadline")}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">{t("날짜", "Date")}</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={draftDate}
                  onChange={(event) => setDraftDate(event.target.value as YMD)}
                  disabled={!canEdit}
                />
              </div>
              <DialogFooter>
                {dday ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="sm:mr-auto"
                    onClick={handleRemove}
                  >
                    {t("삭제", "Delete")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("취소", "Cancel")}
                </Button>
                <Button type="submit" disabled={!canSubmit || !canEdit}>
                  {submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("디데이", "D-Day")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
