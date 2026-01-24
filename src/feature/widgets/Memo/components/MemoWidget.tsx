import { useState } from "react";
import { useMemoWidget } from "@/feature/widgets/Memo/hooks/useMemoWidget";
import { Id } from "@/shared/db/schema";
import { deleteWidgetCascade } from "@/shared/db/db";
import {
  ActionMenuButton,
  ActionMenuItem,
} from "@/shared/ui/buttons/DropdownButton";
import { Pencil, Trash2 } from "lucide-react";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const actions: ActionMenuItem[] = [
    {
      text: "수정",
      icon: <Pencil />,
      onClick: beginEdit,
    },
    {
      text: "위젯 삭제",
      icon: <Trash2 />,
      danger: true,
      onClick: () => setIsDeleteDialogOpen(true),
    },
    // 추가 액션 아이템들을 여기에 넣을 수 있습니다.
  ];

  const handleDelete = async () => {
    await deleteWidgetCascade(widgetId);
    setIsDeleteDialogOpen(false);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  return (
    <WidgetCard>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex items-center justify-end shrink-0">
          {canEdit && !isEditing ? (
            // <Button className="text-xs px-2 py-0 h-7" onClick={beginEdit}>
            //   수정
            // </Button>
            <ActionMenuButton items={actions} />
          ) : null}
        </div>

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
