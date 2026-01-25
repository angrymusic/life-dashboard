import { useCallback, useState } from "react";
import { deleteWidgetCascade } from "@/shared/db/db";
import type { Id } from "@/shared/db/schema";

type UseWidgetDeleteDialogOptions = {
  widgetId: Id;
  onDeleted?: () => void;
};

export function useWidgetDeleteDialog({
  widgetId,
  onDeleted,
}: UseWidgetDeleteDialogOptions) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const confirm = useCallback(async () => {
    await deleteWidgetCascade(widgetId);
    setIsOpen(false);
    onDeleted?.();
  }, [widgetId, onDeleted]);

  return {
    isOpen,
    open,
    close,
    confirm,
  };
}
