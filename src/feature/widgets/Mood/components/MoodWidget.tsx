import { useMoodWidget } from "@/feature/widgets/Mood/hooks/useMoodWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { updateWidgetSettings } from "@/shared/db/db";
import { useWidget } from "@/shared/db/queries";
import type { Id, Mood } from "@/shared/db/schema";
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
import { Angry, Frown, Laugh, Meh, Pencil, Smile } from "lucide-react";
import type { ComponentType, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

type MoodValue = Mood["mood"];

type MoodOption = {
  value: MoodValue;
  label: string;
};

const MOOD_OPTIONS: MoodOption[] = [
  { value: "great", label: "매우 행복" },
  { value: "good", label: "행복" },
  { value: "ok", label: "그저 그럼" },
  { value: "bad", label: "슬픔.." },
  { value: "awful", label: "화남!" },
];

const MOOD_ICONS: Record<MoodValue, ComponentType<{ className?: string }>> = {
  great: Laugh,
  good: Smile,
  ok: Meh,
  bad: Frown,
  awful: Angry,
};

const MOOD_TONES: Record<MoodValue, string> = {
  great:
    "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
  good: "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  ok: "border-slate-200/70 bg-slate-50 text-slate-600 dark:border-slate-400/30 dark:bg-slate-500/10 dark:text-slate-200",
  bad: "border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200",
  awful:
    "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200",
};

const EMPTY_PANEL_CLASS =
  "border-gray-200/70 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400";

type MoodWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function MoodWidget({ widgetId, canEdit = true }: MoodWidgetProps) {
  const { mood, setMood } = useMoodWidget(widgetId);
  const widget = useWidget(widgetId);
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const selectedMood = mood?.mood ?? null;
  const selectedOption = useMemo(
    () =>
      selectedMood
        ? MOOD_OPTIONS.find((option) => option.value === selectedMood) ?? null
        : null,
    [selectedMood]
  );

  const currentTitle = useMemo(() => {
    const settings = widget?.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings))
      return "";
    const value = (settings as Record<string, unknown>).title;
    return typeof value === "string" ? value : "";
  }, [widget?.settings]);

  const openTitleDialog = useCallback(() => {
    if (!canEdit) return;
    setDraftTitle(currentTitle);
    setTitleDialogOpen(true);
  }, [canEdit, currentTitle]);

  const handleTitleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canEdit) return;
      if (!widget) return;
      const trimmed = draftTitle.trim();
      if (trimmed === currentTitle) {
        setTitleDialogOpen(false);
        return;
      }

      const settings =
        widget.settings &&
        typeof widget.settings === "object" &&
        !Array.isArray(widget.settings)
          ? (widget.settings as Record<string, unknown>)
          : {};
      const nextSettings = { ...settings };
      if (trimmed) {
        nextSettings.title = trimmed;
      } else {
        delete nextSettings.title;
      }
      await updateWidgetSettings(widget.id, nextSettings);
      setTitleDialogOpen(false);
    },
    [canEdit, widget, draftTitle, currentTitle]
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
    deleteLabel: "위젯 삭제",
    extraItems: [
      {
        text: "이름 설정",
        icon: <Pencil className="size-4" />,
        onClick: openTitleDialog,
      },
      ...MOOD_OPTIONS.map((option) => {
        const Icon = MOOD_ICONS[option.value];
        return {
          text: option.label,
          icon: <Icon className="size-4" />,
          onClick: () => {
            void setMood(option.value);
          },
          disabled: option.value === selectedMood,
        };
      }),
    ],
  });

  const PanelIcon = selectedMood ? MOOD_ICONS[selectedMood] : Meh;
  const label = selectedOption?.label ?? "기분이 어때요?";
  const tone = selectedMood ? MOOD_TONES[selectedMood] : EMPTY_PANEL_CLASS;
  const titleText = currentTitle ? `${currentTitle}의 기분` : "기분";

  return (
    <WidgetCard
      header={
        <WidgetHeader title={titleText} actions={actions} canEdit={canEdit} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {selectedMood && (
          <div className="mt-1 flex flex-1 items-center justify-center">
            <div
              className={cn(
                "flex size-24 flex-col items-center justify-center rounded-2xl border px-4 py-4 text-center",
                tone
              )}
            >
              <PanelIcon className="size-12" />
              <div className="text-xs whitespace-nowrap">{label}</div>
            </div>
          </div>
        )}

        {!selectedMood && canEdit ? (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {MOOD_OPTIONS.map((option) => {
              const Icon = MOOD_ICONS[option.value];
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void setMood(option.value)}
                  className="flex size-20 shrink-0 self-start flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200/70 text-[11px] text-gray-600 transition hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500"
                >
                  <Icon className="size-12 shrink-0" />
                  <span className="font-medium leading-none whitespace-nowrap">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <Dialog
          open={titleDialogOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setTitleDialogOpen(false);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>이름 설정</DialogTitle>
              <DialogDescription>
                감정 위젯에 표시할 이름을 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTitleSubmit} className="grid gap-3">
              <div>
                <label className="text-[11px] text-gray-400">이름</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="예: 민지"
                  disabled={!canEdit}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTitleDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={!canEdit}>
                  저장
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName="감정"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
