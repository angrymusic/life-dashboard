import { useState } from "react";
import type { CalendarEventInstance } from "@/feature/widgets/Calendar/libs/calendarUtils";
import {
  formatEventTime,
  formatYearMonthDay,
} from "@/feature/widgets/Calendar/libs/calendarUtils";
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
  const [deleteScope, setDeleteScope] = useState<DeleteScope>("future");

  if (!event) return null;

  const isRecurring = Boolean(event.recurrence);
  const selectedLabel = formatYearMonthDay(selectedDate);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>일정을 삭제할까요?</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {event.title}
            </div>
            <div>{formatEventTime(event)}</div>
            {isRecurring ? (
              <div className="text-xs text-gray-400">
                선택한 날짜: {selectedLabel}
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
                  <span className="font-medium">선택한 날 이후 삭제</span>
                  <span className="text-gray-400">선택한 날짜 포함</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                  <input
                    type="radio"
                    name="calendar-delete-scope"
                    value="all"
                    checked={deleteScope === "all"}
                    onChange={() => setDeleteScope("all")}
                  />
                  <span className="font-medium">전체 삭제</span>
                </label>
              </div>
            ) : null}
          </div>
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
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
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
