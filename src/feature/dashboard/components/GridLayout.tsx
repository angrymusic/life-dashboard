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
import {
  getLayoutUpdates,
  toGridLayout,
} from "@/feature/dashboard/libs/layout";
import {
  WidgetRegistry,
  isAddableWidgetType,
} from "@/feature/dashboard/libs/widgetRegistry";

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
            const entry = isAddableWidgetType(w.type)
              ? WidgetRegistry[w.type]
              : null;
            return (
              <div key={w.id} className="h-full">
                {entry ? entry.render({ widgetId: w.id, canEdit }) : null}
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}
