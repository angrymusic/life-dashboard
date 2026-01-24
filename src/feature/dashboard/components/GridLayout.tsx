"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
} from "react-grid-layout";
import type { Widget } from "@/shared/db/schema";
import { CalendarWidget } from "@/feature/widgets/Calendar/components/CalendarWidget";
import { MemoWidget } from "@/feature/widgets/Memo/components/MemoWidget";
import {
  applyGridLayout,
  toGridLayout,
} from "@/feature/dashboard/libs/layout";

type Props = {
  widgets: Widget[];
  onLayoutChange: (next: Widget[]) => void;
};

export default function GridLayout({ widgets, onLayoutChange }: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const compactor = { ...noCompactor, preventCollision: true };

  const layout = toGridLayout(widgets);

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{ cols: 12, rowHeight: 30 }}
          compactor={compactor}
          dragConfig={{
            cancel: "textarea, input, button, select, a",
          }}
          onLayoutChange={(nextLayout) =>
            onLayoutChange(applyGridLayout(widgets, nextLayout))
          }
        >
          {widgets.map((w) => (
            <div key={w.id} className="h-full">
              {w.type === "memo" ? <MemoWidget widgetId={w.id} /> : null}
              {w.type === "calendar" ? (
                <CalendarWidget widgetId={w.id} />
              ) : null}
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
