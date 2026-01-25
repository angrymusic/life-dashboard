import { createElement, useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { Id } from "@/shared/db/schema";
import type { ActionMenuItem } from "@/shared/ui/buttons/DropdownButton";
import { useWidgetDeleteDialog } from "@/feature/widgets/shared/hooks/useWidgetDeleteDialog";

type UseWidgetActionMenuOptions = {
  widgetId: Id;
  canEdit?: boolean;
  extraItems?: ActionMenuItem[];
  deleteLabel?: string;
  onDeleted?: () => void;
};

export function useWidgetActionMenu({
  widgetId,
  canEdit = true,
  extraItems = [],
  deleteLabel = "Delete widget",
  onDeleted,
}: UseWidgetActionMenuOptions) {
  const deleteDialog = useWidgetDeleteDialog({ widgetId, onDeleted });

  const actions = useMemo<ActionMenuItem[]>(() => {
    if (!canEdit) return [];

    return [
      ...extraItems,
      {
        text: deleteLabel,
        icon: createElement(Trash2),
        danger: true,
        onClick: deleteDialog.open,
      },
    ];
  }, [canEdit, extraItems, deleteDialog.open, deleteLabel]);

  return {
    actions,
    deleteDialog,
  };
}
