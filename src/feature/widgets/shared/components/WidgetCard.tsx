import { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type WidgetCardProps = PropsWithChildren<{
  title?: string;
  header?: ReactNode;
  className?: string;
}>;

export function WidgetCard({
  title,
  header,
  className,
  children,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        "@container flex flex-col border rounded-lg shadow-sm w-full h-full p-4 bg-card dark:bg-gray-800 overflow-hidden",
        className
      )}
    >
      {header ? <div className="mb-2">{header}</div> : null}
      {title && !header ? (
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
      ) : null}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
