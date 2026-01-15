import { PropsWithChildren } from "react";

type WidgetCardProps = PropsWithChildren<{
  title?: string;
}>;

export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <div className="flex flex-col border rounded-lg shadow-sm w-full h-full p-4 bg-white dark:bg-gray-800 overflow-hidden">
      <div
        className="widget-drag-handle absolute left-0 right-0 top-0 h-10 z-10 cursor-grab active:cursor-grabbing"
        aria-hidden
      />
      {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
