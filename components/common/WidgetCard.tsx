export function WidgetCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border rounded-lg shadow-sm p-4 bg-white dark:bg-gray-800 ">
      <div
        className="widget-drag-handle absolute left-0 right-0 top-0 h-10 z-10 cursor-grab active:cursor-grabbing"
        aria-hidden
      />
      {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
      <div>{children}</div>
    </div>
  );
}
