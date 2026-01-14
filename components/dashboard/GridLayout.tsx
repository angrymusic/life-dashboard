"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
} from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import type { Widget } from "@/db/schema";
import { MemoWidget } from "./widgets/MemoWidget";

type Props = {
  widgets: Widget[];
  onLayoutChange: (next: Widget[]) => void;
};

export default function GridLayout({ widgets, onLayoutChange }: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const compactor = { ...noCompactor, preventCollision: true };

  const layout: Layout = widgets.map((w) => ({ ...w.layout, i: w.id }));

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{ cols: 12, rowHeight: 30 }}
          compactor={compactor}
          dragConfig={{
            enabled: true,
            handle: ".widget-drag-handle",
            cancel: "textarea, input, button, select, a",
          }}
          onLayoutChange={(nextLayout) => {
            const next = widgets.map((w) => {
              const l = nextLayout.find((it) => it.i === w.id);
              if (!l) return w;

              const { i: _i, ...layoutWithoutI } = l;

              return { ...w, layout: layoutWithoutI };
            });

            onLayoutChange(next);
          }}
        >
          {widgets.map((w) => (
            <div key={w.id} className="h-full">
              {w.type === "memo" ? <MemoWidget widgetId={w.id} /> : null}
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
