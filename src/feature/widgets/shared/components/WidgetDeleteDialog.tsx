import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

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
  const title = widgetName
    ? `${widgetName} 위젯을 삭제할까요?`
    : "위젯을 삭제할까요?";
  const description = widgetName
    ? `${widgetName} 위젯을 삭제하면 되돌릴 수 없습니다.`
    : "위젯을 삭제하면 되돌릴 수 없습니다.";

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
            취소
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
