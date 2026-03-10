"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type DashboardManagerConfirmDialogProps = {
  open: boolean;
  title: string;
  name?: string;
  description: string;
  note?: string;
  error?: string | null;
  cancelLabel: string;
  confirmLabel: string;
  confirmingLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export default function DashboardManagerConfirmDialog({
  open,
  title,
  name,
  description,
  note,
  error,
  cancelLabel,
  confirmLabel,
  confirmingLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: DashboardManagerConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-gray-500">
            {name ? (
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {name}
              </div>
            ) : null}
            <div>{description}</div>
            {note ? <div className="text-xs text-gray-400">{note}</div> : null}
            {error ? <div className="text-xs text-red-500">{error}</div> : null}
          </div>
        </DialogDescription>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? confirmingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
