import { ReactNode } from "react";
import {
  ActionMenuButton,
  ActionMenuItem,
} from "@/shared/ui/buttons/DropdownButton";
import { cn } from "@/shared/lib/utils";

type WidgetHeaderProps = {
  title?: string;
  left?: ReactNode;
  actions?: ActionMenuItem[];
  canEdit?: boolean;
  className?: string;
  triggerAriaLabel?: string;
};

export function WidgetHeader({
  title,
  left,
  actions,
  canEdit = true,
  className,
  triggerAriaLabel,
}: WidgetHeaderProps) {
  const actionItems = actions ?? [];
  const showActions = actionItems.length > 0 && canEdit;
  const content = left ?? (
    title ? <h2 className="text-lg font-semibold">{title}</h2> : null
  );

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex min-w-0 flex-1 items-center">{content}</div>
      {showActions ? (
        <ActionMenuButton
          items={actionItems}
          triggerAriaLabel={triggerAriaLabel}
        />
      ) : null}
    </div>
  );
}
