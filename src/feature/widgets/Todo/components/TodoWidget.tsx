import type { FormEvent } from "react";
import { useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Id } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { useTodoWidget } from "@/feature/widgets/Todo/hooks/useTodoWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatMonthDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function formatDateLabel(date: Date) {
  const monthDay = formatMonthDay(date);
  const weekDay = WEEK_DAYS[date.getDay()] ?? "";
  return `${monthDay} ${weekDay}`.trim();
}

type TodoWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function TodoWidget({ widgetId, canEdit = true }: TodoWidgetProps) {
  const {
    todos,
    selectedDate,
    isToday,
    draftTitle,
    setDraftTitle,
    addTodo,
    toggleTodo,
    deleteTodo,
    goPrevDay,
    goNextDay,
    goToday,
  } = useTodoWidget(widgetId);

  const totalCount = todos.length;
  const completedCount = useMemo(
    () => todos.filter((todo) => todo.done).length,
    [todos]
  );
  const dateLabel = useMemo(
    () => formatDateLabel(selectedDate),
    [selectedDate]
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
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    void addTodo();
  };

  return (
    <WidgetCard
      header={<WidgetHeader title="할 일" actions={actions} canEdit={canEdit} />}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="이전 날짜"
              onClick={goPrevDay}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[80px] text-center leading-tight">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {isToday ? "오늘" : dateLabel}
              </div>
              {isToday ? (
                <div className="text-[11px] text-gray-400">{dateLabel}</div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="다음 날짜"
              onClick={goNextDay}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!isToday ? (
              <Button variant="ghost" size="sm" onClick={goToday}>
                오늘
              </Button>
            ) : null}
            <span className="text-xs text-gray-400">
              완료 {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <input
            className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="할 일을 입력하세요"
            disabled={!canEdit}
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canEdit || !draftTitle.trim()}
            aria-label="할 일 추가"
          >
            <Plus className="size-4" />
          </Button>
        </form>

        <div className="mt-3 flex-1 min-h-0 overflow-auto">
          {totalCount === 0 ? (
            <div className="text-sm text-gray-400">할 일이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-center gap-2 rounded-md border border-gray-200/70 dark:border-gray-700 px-2 py-1.5"
                >
                  <button
                    type="button"
                    aria-label={
                      todo.done ? "완료 해제" : "할 일 완료로 표시"
                    }
                    onClick={() => {
                      if (!canEdit) return;
                      void toggleTodo(todo);
                    }}
                    disabled={!canEdit}
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border transition",
                      todo.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-gray-300 dark:border-gray-600 text-transparent",
                      !canEdit ? "opacity-60" : ""
                    )}
                  >
                    {todo.done ? <Check className="size-3" /> : null}
                  </button>
                  <span
                    className={cn(
                      "flex-1 min-w-0 text-sm",
                      todo.done
                        ? "text-gray-400 line-through"
                        : "text-gray-900 dark:text-gray-100"
                    )}
                  >
                    {todo.title}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => void deleteTodo(todo.id)}
                      className="rounded-md p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-gray-600"
                      aria-label="할 일 삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
          {!canEdit && <span className="opacity-70">읽기 전용</span>}
        </div>

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName="할 일"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
