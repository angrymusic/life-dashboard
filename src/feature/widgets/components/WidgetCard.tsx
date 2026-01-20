import { PropsWithChildren } from "react";

type WidgetCardProps = PropsWithChildren<{
  title?: string;
}>;

export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <div className="flex flex-col border rounded-lg shadow-sm w-full h-full p-4 bg-card dark:bg-gray-800 overflow-hidden">
      {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
