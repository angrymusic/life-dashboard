"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { WidgetType } from "@/shared/db/schema";
import { widgetOptions } from "@/feature/dashboard/libs/widgetOptions";

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
          {widgetOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => setSelected(option.type)}
              className={[
                "text-left rounded-lg border p-3 transition",
                selected === option.type
                  ? "border-gray-900 dark:border-gray-100"
                  : "border-gray-200 dark:border-gray-700",
              ].join(" ")}
            >
              <div className="font-medium">{option.title}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </button>
          ))}
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
