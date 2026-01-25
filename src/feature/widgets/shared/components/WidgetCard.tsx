import { PropsWithChildren, ReactNode } from "react";

type WidgetCardProps = PropsWithChildren<{
  title?: string;
  header?: ReactNode;
}>;

export function WidgetCard({ title, header, children }: WidgetCardProps) {
  return (
    <div className="flex flex-col border rounded-lg shadow-sm w-full h-full p-4 bg-card dark:bg-gray-800 overflow-hidden">
      {header ? <div className="mb-2">{header}</div> : null}
      {title && !header ? (
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
      ) : null}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
