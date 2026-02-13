import { useMemoWidget } from "@/feature/widgets/Memo/hooks/useMemoWidget";
import { Id } from "@/shared/db/schema";
import { Pencil } from "lucide-react";
import { useEffect, useRef } from "react";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { useI18n } from "@/shared/i18n/client";

type MemoWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function MemoWidget({ widgetId, canEdit = true }: MemoWidgetProps) {
  const { t } = useI18n();
  const hasAttemptedAutoEditRef = useRef(false);
  const {
    memo,
    value,
    isEditing,
    beginEdit,
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
    deleteLabel: t("위젯 삭제", "Delete widget"),
    extraItems: [
      {
        text: t("수정", "Edit"),
        icon: <Pencil />,
        onClick: beginEdit,
      },
    ],
  });

  useEffect(() => {
    if (!memo) return;
    if (!canEdit) return;
    if (hasAttemptedAutoEditRef.current) return;

    hasAttemptedAutoEditRef.current = true;
    if (!memo.text.trim()) {
      beginEdit();
    }
  }, [memo, canEdit, beginEdit]);

  const content = value?.trim() ? (
    value
  ) : (
    <span className="text-gray-400">{t("메모가 없습니다", "No memo")}</span>
  );

  return (
    <WidgetCard
      header={
        <WidgetHeader
          className="shrink-0"
          actions={actions}
          canEdit={canEdit}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {isEditing ? (
          <textarea
            className="w-full flex-1 min-h-0 resize-none rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-base outline-none focus:ring-1 focus:ring-blue-500"
            value={value}
            placeholder={t("메모를 입력하세요", "Enter a memo")}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <>
            {canEdit ? (
              <button
                type="button"
                onClick={beginEdit}
                className="w-full flex-1 min-h-0 overflow-auto rounded-md border border-transparent p-2 text-left text-sm whitespace-pre-wrap break-words transition hover:bg-gray-50/70 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:hover:bg-gray-900/40"
              >
                {content}
              </button>
            ) : (
              <div className="w-full flex-1 min-h-0 overflow-auto rounded-md border border-transparent p-2 text-sm whitespace-pre-wrap break-words">
                {content}
              </div>
            )}
          </>
        )}

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("메모", "Memo")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
