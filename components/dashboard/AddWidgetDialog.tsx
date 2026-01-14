"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { WidgetType } from "@/db/schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: WidgetType) => void;
};

export function AddWidgetDialog({ open, onOpenChange, onAdd }: Props) {
  const [selected, setSelected] = useState<WidgetType | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSelected(null);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>위젯 추가</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setSelected("memo")}
            className={[
              "text-left rounded-lg border p-3 transition",
              selected === "memo" ? "border-gray-900 dark:border-gray-100" : "border-gray-200 dark:border-gray-700",
            ].join(" ")}
          >
            <div className="font-medium">Memo</div>
            <div className="text-sm text-gray-500">간단한 메모를 적어요</div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onAdd(selected);
              onOpenChange(false);
              setSelected(null);
            }}
          >
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
