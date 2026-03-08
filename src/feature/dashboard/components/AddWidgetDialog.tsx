"use client";

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { useI18n } from "@/shared/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const DIALOG_CLOSE_DELAY_MS = 200;

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
  disabled = false,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<AddableWidgetType | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const getWidgetTitle = (type: AddableWidgetType) => {
    switch (type) {
      case "calendar":
        return t("달력", "Calendar");
      case "memo":
        return t("메모", "Memo");
      case "photo":
        return t("사진", "Photo");
      case "todo":
        return t("할 일", "Todo");
      case "dday":
        return t("디데이", "D-Day");
      case "mood":
        return t("기분", "Mood");
      case "chart":
        return t("차트", "Chart");
      case "weather":
        return t("날씨", "Weather");
      default:
        return type;
    }
  };
  const getWidgetDescription = (type: AddableWidgetType) => {
    switch (type) {
      case "calendar":
        return t("월간 일정과 이벤트를 확인해요", "View monthly schedules and events");
      case "memo":
        return t("간단한 메모를 적어요", "Write quick notes");
      case "photo":
        return t("사진을 올려요", "Upload photos");
      case "todo":
        return t("오늘 할 일을 체크해요", "Track today's tasks");
      case "dday":
        return t("목표일까지 남은 날짜를 확인해요", "Count down to your target date");
      case "mood":
        return t("현재 기분을 골라요", "Pick your current mood");
      case "chart":
        return t("목표 진행을 시간 순으로 기록해요", "Track progress over time");
      case "weather":
        return t("이번 주 날씨를 확인해요", "Check this week's weather");
      default:
        return "";
    }
  };

  const handleAdd = (type: AddableWidgetType) => {
    if (disabled) return;
    onOpenChange(false);
    setSelected(null);
    window.setTimeout(() => {
      onAdd(type);
    }, DIALOG_CLOSE_DELAY_MS);
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
          <DialogTitle>{t("위젯 추가", "Add widget")}</DialogTitle>
          <DialogDescription>
            {t(
              "추가할 위젯 종류를 선택하세요.",
              "Choose the type of widget to add."
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid max-h-[min(56svh,24rem)] gap-2 overflow-y-auto pr-1"
          role="radiogroup"
          aria-label={t("위젯 종류", "Widget type")}
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
              <div className="font-medium">{getWidgetTitle(option.type)}</div>
              <div className="text-sm text-gray-500">
                {getWidgetDescription(option.type)}
              </div>
            </button>
          ))}
        </div>

        <DialogFooter className="pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("취소", "Cancel")}
          </Button>
          <Button
            disabled={disabled || !selected}
            onClick={() => {
              if (!selected) return;
              handleAdd(selected);
            }}
          >
            {t("추가", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
