import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { Lock } from "lucide-react";
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
  const showReadOnlyHint = !canEdit;
  const content = left ?? (
    title ? <h2 className="text-lg font-semibold">{title}</h2> : null
  );

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex min-w-0 flex-1 items-center">{content}</div>
      <div className="flex items-center gap-1">
        {showReadOnlyHint ? <ReadOnlyLockHint /> : null}
        {showActions ? (
          <ActionMenuButton
            items={actionItems}
            triggerAriaLabel={triggerAriaLabel}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReadOnlyLockHint() {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHoverSuppressed, setIsHoverSuppressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const isOpen = isPinnedOpen || (isHovered && !isHoverSuppressed);

  useEffect(() => {
    if (!isPinnedOpen) return;
    const timeoutId = window.setTimeout(() => setIsPinnedOpen(false), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [isPinnedOpen]);

  useEffect(() => {
    if (!isPinnedOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setIsPinnedOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPinnedOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPinnedOpen]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsHoverSuppressed(false);
      }}
    >
      <button
        type="button"
        aria-label="수정 권한 안내"
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-pressed={isPinnedOpen}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          isPinnedOpen ? "bg-accent text-accent-foreground" : ""
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsPinnedOpen((prev) => {
            const next = !prev;
            if (next) setIsHoverSuppressed(true);
            return next;
          });
        }}
      >
        <Lock className="size-4" />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full right-0 z-20 mt-1 w-max max-w-[12rem] rounded-md border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-sm transition",
          isOpen ? "translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
        )}
      >
        작성자만 수정 가능
      </div>
    </div>
  );
}
