import { useState } from "react";
import type { CalendarEventInstance } from "@/feature/widgets/Calendar/libs/calendarUtils";
import {
  formatEventTime,
  formatYearMonthDay,
} from "@/feature/widgets/Calendar/libs/calendarUtils";
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

type CalendarDeleteDialogProps = {
  open: boolean;
  event: CalendarEventInstance | null;
  selectedDate: Date;
  onClose: () => void;
  onDeleteAll: () => void;
  onDeleteFuture: () => void;
};

type DeleteScope = "future" | "all";

export function CalendarDeleteDialog({
  open,
  event,
  selectedDate,
  onClose,
  onDeleteAll,
  onDeleteFuture,
}: CalendarDeleteDialogProps) {
  const { t, locale } = useI18n();
  const [deleteScope, setDeleteScope] = useState<DeleteScope>("future");

  if (!event) return null;

  const isRecurring = Boolean(event.recurrence);
  const selectedLabel = formatYearMonthDay(selectedDate, locale);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("일정을 삭제할까요?", "Delete event?")}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {event.title}
            </div>
            <div>{formatEventTime(event, locale)}</div>
            {isRecurring ? (
              <div className="text-xs text-gray-400">
                {t("선택한 날짜", "Selected date")}: {selectedLabel}
              </div>
            ) : null}
            {isRecurring ? (
              <div className="grid gap-2 pt-2 text-xs text-gray-500">
                <label className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                  <input
                    type="radio"
                    name="calendar-delete-scope"
                    value="future"
                    checked={deleteScope === "future"}
                    onChange={() => setDeleteScope("future")}
                  />
                  <span className="font-medium">
                    {t("선택한 날 이후 삭제", "Delete from selected date")}
                  </span>
                  <span className="text-gray-400">
                    {t("선택한 날짜 포함", "Including selected date")}
                  </span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                  <input
                    type="radio"
                    name="calendar-delete-scope"
                    value="all"
                    checked={deleteScope === "all"}
                    onChange={() => setDeleteScope("all")}
                  />
                  <span className="font-medium">{t("전체 삭제", "Delete all")}</span>
                </label>
              </div>
            ) : null}
          </div>
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("취소", "Cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={
              isRecurring
                ? deleteScope === "all"
                  ? onDeleteAll
                  : onDeleteFuture
                : onDeleteAll
            }
          >
            {t("삭제", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
