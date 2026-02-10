"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useCallback, useMemo } from "react";
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
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

const MOBILE_BREAKPOINT = 768;

const sortByPosition = (a: Layout[number], b: Layout[number]) => {
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.i.localeCompare(b.i);
};

const toMobileStackLayout = (layout: Layout): Layout => {
  const sorted = [...layout].sort(sortByPosition);
  let nextY = 0;

  return sorted.map((item) => {
    const minHeight = Math.max(item.minH ?? 1, 1);
    const maxHeight = item.maxH;
    const constrainedHeight =
      maxHeight !== undefined
        ? Math.min(Math.max(item.h, minHeight), maxHeight)
        : Math.max(item.h, minHeight);

    const nextItem = {
      ...item,
      x: 0,
      y: nextY,
      w: 1,
      h: constrainedHeight,
      minW: 1,
      maxW: 1,
    };

    nextY += nextItem.h;
    return nextItem;
  });
};

export default function GridLayout({
  widgets,
  onLayoutCommit,
  canEditWidget,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const isMobileViewport = mounted && width < MOBILE_BREAKPOINT;
  const compactor = verticalCompactor;

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
  const canEditLayout = canEditAny && !isMobileViewport;
  const layout = useMemo(() => {
    return toGridLayout(widgets).map((item) => {
      const canEdit = editableById.get(item.i) ?? true;
      return { ...item, static: Boolean(item.static) || !canEdit };
    });
  }, [widgets, editableById]);
  const renderedLayout = useMemo(
    () => (isMobileViewport ? toMobileStackLayout(layout) : layout),
    [isMobileViewport, layout]
  );
  const gridConfig = useMemo(
    () =>
      isMobileViewport
        ? {
            cols: 1,
            rowHeight: 28,
            margin: [0, 12] as const,
            containerPadding: [6, 6] as const,
          }
        : {
            cols: 12,
            rowHeight: 30,
          },
    [isMobileViewport]
  );
  const handleLayoutCommit = useCallback(
    (nextLayout: Layout) => {
      if (!canEditLayout) return;
      const updates = getLayoutUpdates(widgets, nextLayout);
      const allowedUpdates = updates.filter(
        (widget) => editableById.get(widget.id) ?? false
      );
      if (allowedUpdates.length === 0) return;
      onLayoutCommit(allowedUpdates);
    },
    [canEditLayout, onLayoutCommit, widgets, editableById]
  );

  return (
    <div ref={containerRef} className="px-2 pb-24 sm:px-4">
      {mounted && (
        <ReactGridLayout
          layout={renderedLayout}
          width={width}
          gridConfig={gridConfig}
          compactor={compactor}
          dragConfig={{
            cancel: "textarea, input, button, select, a",
            enabled: canEditLayout,
          }}
          resizeConfig={{ enabled: canEditLayout }}
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
