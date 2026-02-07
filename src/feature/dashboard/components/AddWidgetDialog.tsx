"use client";

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  widgetOptions,
  type AddableWidgetType,
} from "@/feature/dashboard/libs/widgetRegistry";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: AddableWidgetType) => void;
  disabled?: boolean;
};

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
  disabled = false,
}: Props) {
  const [selected, setSelected] = useState<AddableWidgetType | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleAdd = (type: AddableWidgetType) => {
    if (disabled) return;
    onAdd(type);
    onOpenChange(false);
    setSelected(null);
  };

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

        <div
          className="grid max-h-[min(56svh,24rem)] gap-2 overflow-y-auto pr-1"
          role="radiogroup"
          aria-label="위젯 종류"
          onKeyDown={(event) => {
            const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
            if (!keys.includes(event.key)) return;

            event.preventDefault();

            const currentIndex = selected
              ? widgetOptions.findIndex((option) => option.type === selected)
              : 0;
            const direction =
              event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
            const nextIndex =
              (currentIndex + direction + widgetOptions.length) %
              widgetOptions.length;
            const nextType = widgetOptions[nextIndex]?.type;

            if (!nextType) return;

            setSelected(nextType);
            optionRefs.current[nextIndex]?.focus();
          }}
        >
          {widgetOptions.map((option, index) => (
            <button
              key={option.type}
              type="button"
              onClick={() => setSelected(option.type)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handleAdd(option.type);
              }}
              disabled={disabled}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="radio"
              aria-checked={selected === option.type}
              tabIndex={
                selected
                  ? selected === option.type
                    ? 0
                    : -1
                  : index === 0
                    ? 0
                    : -1
              }
              className={[
                "text-left rounded-lg border p-3 transition",
                disabled ? "opacity-60 cursor-not-allowed" : "",
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

        <DialogFooter className="pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            disabled={disabled || !selected}
            onClick={() => {
              if (!selected) return;
              handleAdd(selected);
            }}
          >
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
