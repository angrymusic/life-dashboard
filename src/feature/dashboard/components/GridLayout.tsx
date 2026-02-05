"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useCallback, useMemo } from "react";
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
  getLayoutUpdates,
  toGridLayout,
} from "@/feature/dashboard/libs/layout";

type Props = {
  widgets: Widget[];
  onLayoutCommit: (next: Widget[]) => void;
  canEditWidget?: (widget: Widget) => boolean;
};

export default function GridLayout({
  widgets,
  onLayoutCommit,
  canEditWidget,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const compactor = useMemo(
    () => ({ ...noCompactor, preventCollision: true }),
    []
  );

  const editableById = useMemo(() => {
    return new Map(
      widgets.map((widget) => [
        widget.id,
        canEditWidget ? canEditWidget(widget) : true,
      ])
    );
  }, [widgets, canEditWidget]);
  const canEditAny = useMemo(() => {
    if (!canEditWidget) return true;
    return widgets.some((widget) => canEditWidget(widget));
  }, [widgets, canEditWidget]);
  const layout = useMemo(() => {
    return toGridLayout(widgets).map((item) => {
      const canEdit = editableById.get(item.i) ?? true;
      return { ...item, static: Boolean(item.static) || !canEdit };
    });
  }, [widgets, editableById]);
  const handleLayoutCommit = useCallback(
    (nextLayout: Layout) => {
      if (!canEditAny) return;
      const updates = getLayoutUpdates(widgets, nextLayout);
      const allowedUpdates = updates.filter(
        (widget) => editableById.get(widget.id) ?? false
      );
      if (allowedUpdates.length === 0) return;
      onLayoutCommit(allowedUpdates);
    },
    [canEditAny, onLayoutCommit, widgets, editableById]
  );

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
            enabled: canEditAny,
          }}
          resizeConfig={{ enabled: canEditAny }}
          onDragStop={handleLayoutCommit}
          onResizeStop={handleLayoutCommit}
        >
          {widgets.map((w) => {
            const canEdit = editableById.get(w.id) ?? true;
            return (
              <div key={w.id} className="h-full">
                {w.type === "memo" ? (
                  <MemoWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "todo" ? (
                  <TodoWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "dday" ? (
                  <DdayWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "mood" ? (
                  <MoodWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "photo" ? (
                  <PhotoWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "chart" ? (
                  <ChartWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "calendar" ? (
                  <CalendarWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
                {w.type === "weather" ? (
                  <WeatherWidget widgetId={w.id} canEdit={canEdit} />
                ) : null}
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}
