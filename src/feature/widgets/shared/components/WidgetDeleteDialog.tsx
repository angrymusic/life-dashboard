import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useI18n } from "@/shared/i18n/client";

type WidgetDeleteDialogProps = {
  open: boolean;
  widgetName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function WidgetDeleteDialog({
  open,
  widgetName,
  onClose,
  onConfirm,
}: WidgetDeleteDialogProps) {
  const { t } = useI18n();
  const title = widgetName
    ? t(`${widgetName} 위젯을 삭제할까요?`, `Delete ${widgetName} widget?`)
    : t("위젯을 삭제할까요?", "Delete widget?");
  const description = widgetName
    ? t(
        `${widgetName} 위젯을 삭제하면 되돌릴 수 없습니다.`,
        `Deleting ${widgetName} widget cannot be undone.`
      )
    : t("위젯을 삭제하면 되돌릴 수 없습니다.", "Deleting this widget cannot be undone.");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-gray-500">
          {description}
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("취소", "Cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {t("삭제", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
