import { useMemoWidget } from "@/feature/widgets/Memo/hooks/useMemoWidget";
import { Id } from "@/shared/db/schema";
import { Pencil } from "lucide-react";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";

type MemoWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function MemoWidget({ widgetId, canEdit = true }: MemoWidgetProps) {
  const {
    value,
    isEditing,
    beginEdit, // ✅ 훅에 추가 추천
    handleChange,
    handleBlur,
    handleKeyDown,
  } = useMemoWidget(widgetId);
  const canShowActions = canEdit && !isEditing;
  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit: canShowActions,
    deleteLabel: "위젯 삭제",
    extraItems: [
      {
        text: "수정",
        icon: <Pencil />,
        onClick: beginEdit,
      },
    ],
  });

  return (
    <WidgetCard>
      <div className="flex h-full min-h-0 flex-col">
        <WidgetHeader
          className="mb-2 shrink-0"
          actions={actions}
          canEdit={canShowActions}
        />

        {/* 본문 */}
        {isEditing ? (
          <textarea
            className="w-full flex-1 min-h-0 resize-none rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={value}
            placeholder="메모를 입력하세요"
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <div className="w-full flex-1 min-h-0 overflow-auto rounded-md border border-transparent p-2 text-sm whitespace-pre-wrap break-words">
            {value?.trim() ? (
              value
            ) : (
              <span className="text-gray-400">메모가 없습니다</span>
            )}
          </div>
        )}

        {/* 하단 안내 */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
          {!canEdit && <span className="opacity-70">읽기 전용</span>}
        </div>
        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName="메모"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
