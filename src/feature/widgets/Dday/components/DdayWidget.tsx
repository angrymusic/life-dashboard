import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
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

const MS_DAY = 24 * 60 * 60 * 1000;

function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

function formatYmd(ymd: string) {
  const [yyyy, mm, dd] = ymd.split("-");
  if (!yyyy || !mm || !dd) return ymd;
  return `${yyyy}.${mm}.${dd}`;
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
  const { dday, saveDday, deleteDday } = useDdayWidget(widgetId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState<YMD>(() => toYmd(new Date()));

  const openDialog = useCallback(() => {
    if (!canEdit) return;
    setDraftTitle(dday?.title ?? "");
    setDraftDate(dday?.date ?? toYmd(new Date()));
    setDialogOpen(true);
  }, [canEdit, dday]);

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

  const actionLabel = dday ? "수정" : "추가";
  const actionIcon = dday ? <Pencil /> : <Plus />;

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
    deleteLabel: "위젯 삭제",
    extraItems: [
      {
        text: actionLabel,
        icon: actionIcon,
        onClick: openDialog,
      },
    ],
  });

  const diff = dday ? diffDays(dday.date) : null;
  const displayDays = diff === null ? "--" : String(Math.abs(diff));
  const statusLabel =
    diff === null
      ? "날짜를 확인해주세요"
      : diff === 0
      ? "오늘"
      : diff > 0
      ? "남은 날"
      : "지난 날";
  const tone =
    diff === null
      ? "text-gray-400"
      : diff === 0
      ? "text-emerald-600 dark:text-emerald-400"
      : diff > 0
      ? "text-blue-600 dark:text-blue-400"
      : "text-rose-600 dark:text-rose-400";

  const submitLabel = dday ? "저장" : "추가";
  const canSubmit = draftTitle.trim().length > 0 && Boolean(draftDate);

  const content = useMemo(() => {
    if (!dday) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          추가해주세요
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
          <span className="text-xs text-gray-400">{formatYmd(dday.date)}</span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl border border-gray-200/70 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/30">
              <div className={cn("text-4xl font-bold leading-none", tone)}>
                {displayDays === "0" ? "D-DAY" : `D-${displayDays}`}
              </div>
              <div className="mt-1 text-xs text-gray-500">{statusLabel}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [dday, displayDays, statusLabel, tone]);

  return (
    <WidgetCard
      header={
        <WidgetHeader title="디데이" actions={actions} canEdit={canEdit} />
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
              <DialogTitle>{dday ? "디데이 설정" : "디데이 추가"}</DialogTitle>
              <DialogDescription>제목과 날짜를 입력해주세요.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div>
                <label className="text-[11px] text-gray-400">제목</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="예: 프로젝트 마감"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">날짜</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
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
                    삭제
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  취소
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
            widgetName="디데이"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
