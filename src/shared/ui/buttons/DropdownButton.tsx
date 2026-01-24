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
            {item.icon ? (
              <span className="shrink-0 [&_svg]:size-4">{item.icon}</span>
            ) : null}
            <span className="text-sm">{item.text}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
