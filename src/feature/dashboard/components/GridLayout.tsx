"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import ReactGridLayout, {
  noCompactor,
  useContainerWidth,
} from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import type { Widget } from "@/shared/db/schema";
import { CalendarWidget } from "@/feature/widgets/Calendar/components/CalendarWidget";
import { ChartWidget } from "@/feature/widgets/Chart/components/ChartWidget";
import { DdayWidget } from "@/feature/widgets/Dday/components/DdayWidget";
import { MoodWidget } from "@/feature/widgets/Mood/components/MoodWidget";
import { MemoWidget } from "@/feature/widgets/Memo/components/MemoWidget";
import { PhotoWidget } from "@/feature/widgets/Photo/components/PhotoWidget";
import { TodoWidget } from "@/feature/widgets/Todo/components/TodoWidget";
import { WeatherWidget } from "@/feature/widgets/Weather/components/WeatherWidget";
import {
  applyGridLayout,
  toGridLayout,
} from "@/feature/dashboard/libs/layout";

type Props = {
  widgets: Widget[];
  onLayoutCommit: (next: Widget[]) => void;
};

export default function GridLayout({ widgets, onLayoutCommit }: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const compactor = { ...noCompactor, preventCollision: true };

  const layout = toGridLayout(widgets);
  const handleLayoutCommit = (nextLayout: Layout) => {
    onLayoutCommit(applyGridLayout(widgets, nextLayout));
  };

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
          onDragStop={(nextLayout) => handleLayoutCommit(nextLayout)}
          onResizeStop={(nextLayout) => handleLayoutCommit(nextLayout)}
        >
          {widgets.map((w) => (
            <div key={w.id} className="h-full">
              {w.type === "memo" ? <MemoWidget widgetId={w.id} /> : null}
              {w.type === "todo" ? <TodoWidget widgetId={w.id} /> : null}
              {w.type === "dday" ? <DdayWidget widgetId={w.id} /> : null}
              {w.type === "mood" ? <MoodWidget widgetId={w.id} /> : null}
              {w.type === "photo" ? <PhotoWidget widgetId={w.id} /> : null}
              {w.type === "chart" ? <ChartWidget widgetId={w.id} /> : null}
              {w.type === "calendar" ? (
                <CalendarWidget widgetId={w.id} />
              ) : null}
              {w.type === "weather" ? <WeatherWidget widgetId={w.id} /> : null}
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
