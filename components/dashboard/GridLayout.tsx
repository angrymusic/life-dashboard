"use client";

import React from "react";
import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
} from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import type { Widget } from "@/db/schema";
import { MemoWidget } from "./widgets/MemoWidget";
import { WidgetCard } from "../common/WidgetCard";

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
      {/* {mounted && (
        <ReactGridLayout
          layout={[...layout, { i: "dummy", x: 2, y: 0, w: 1, h: 1 }]}
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
          <div key={"dummy"}>
            <WidgetCard>
              <div className="text-sm text-red-500">
                지원하지 않는 위젯 유형입니다.
              </div>
            </WidgetCard>
          </div>
        </ReactGridLayout>
      )} */}
      <ReactGridLayout
        layout={[
          { i: "a", x: 0, y: 0, w: 1, h: 2, static: true },
          { i: "b", x: 1, y: 0, w: 3, h: 2, minW: 2, maxW: 4 },
          { i: "c", x: 4, y: 0, w: 1, h: 2 },
        ]}
        width={width}
        gridConfig={{ cols: 12, rowHeight: 30 }}
      >
        <div key="a">a</div>
        <div key="b">b</div>
        <div key="c">c</div>
      </ReactGridLayout>
    </div>
  );
}
