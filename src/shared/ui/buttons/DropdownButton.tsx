import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export type ActionMenuItem = {
  icon?: React.ReactNode;
  text: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean; // 삭제 같은 빨간 액션용
  toggle?: boolean;
  checked?: boolean;
};

type ActionMenuButtonProps = {
  items: ActionMenuItem[];
  icon?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  triggerAriaLabel?: string;
};

export function ActionMenuButton({
  items,
  icon,
  side = "bottom",
  align = "end",
  triggerAriaLabel = "Open menu",
}: ActionMenuButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md"
          aria-label={triggerAriaLabel}
        >
          {icon || <MoreHorizontal className="size-4" />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-44 rounded-xl border bg-popover p-1 shadow-lg"
      >
        {items.map((item, idx) => (
          <DropdownMenuItem
            key={`${item.text}-${idx}`}
            disabled={item.disabled}
            onSelect={(_e) => {
              // Radix: 기본적으로 select 시 focus 처리/닫힘이 일어나는데,
              // 안전하게 클릭만 실행하고 싶으면 preventDefault 가능.
              // 여기서는 "클릭하면 닫히고 실행"이 자연스러워서 그냥 실행만.
              item.onClick();
            }}
            className={[
              "gap-2 rounded-lg",
              item.danger ? "text-destructive focus:text-destructive" : "",
            ].join(" ")}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {item.icon ? (
                <span className="shrink-0 [&_svg]:size-4">{item.icon}</span>
              ) : null}
              <span className="truncate text-sm">{item.text}</span>
            </div>
            {item.toggle ? (
              <span
                aria-hidden
                className={[
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition",
                  item.checked
                    ? "border-primary bg-primary"
                    : "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition",
                    item.checked ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
