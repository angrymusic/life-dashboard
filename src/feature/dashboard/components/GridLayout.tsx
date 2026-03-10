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
import { cn } from "@/shared/lib/utils";
import {
  getLayoutUpdates,
  toGridLayout,
} from "@/feature/dashboard/libs/layout";
import {
  WidgetRegistry,
  isAddableWidgetType,
} from "@/feature/dashboard/libs/widgetRegistry";
import { useI18n } from "@/shared/i18n/client";
import type { WidgetLockMap } from "@/feature/dashboard/types/widgetLock";

type Props = {
  widgets: Widget[];
  onLayoutCommit: (next: Widget[]) => void;
  canEditWidget?: (widget: Widget) => boolean;
  lockEnabled?: boolean;
  widgetLocks?: WidgetLockMap;
  onTouchWidgetLock?: (widgetId: string) => void;
  onReleaseAllWidgetLocks?: () => void;
  widgetContentClassName?: string;
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
  lockEnabled = false,
  widgetLocks = {},
  onTouchWidgetLock,
  onReleaseAllWidgetLocks,
  widgetContentClassName,
}: Props) {
  const { t } = useI18n();
  const { width, containerRef, mounted } = useContainerWidth();
  const isMobileViewport = mounted && width < MOBILE_BREAKPOINT;
  const compactor = verticalCompactor;

  const permissionEditableById = useMemo(() => {
    return new Map(
      widgets.map((widget) => [
        widget.id,
        canEditWidget ? canEditWidget(widget) : true,
      ])
    );
  }, [widgets, canEditWidget]);
  const effectiveEditableById = useMemo(() => {
    return new Map(
      widgets.map((widget) => {
        const canEditByPermission = permissionEditableById.get(widget.id) ?? true;
        const lock = widgetLocks[widget.id];
        const lockedByOther = lockEnabled && Boolean(lock && !lock.isMine);
        return [widget.id, canEditByPermission && !lockedByOther];
      })
    );
  }, [lockEnabled, permissionEditableById, widgetLocks, widgets]);
  const canEditAny = useMemo(() => {
    return widgets.some((widget) => effectiveEditableById.get(widget.id) ?? false);
  }, [widgets, effectiveEditableById]);
  const canEditLayout = canEditAny && !isMobileViewport;
  const layout = useMemo(() => {
    return toGridLayout(widgets).map((item) => {
      const canEdit = effectiveEditableById.get(item.i) ?? true;
      return { ...item, static: Boolean(item.static) || !canEdit };
    });
  }, [widgets, effectiveEditableById]);
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
        (widget) => effectiveEditableById.get(widget.id) ?? false
      );
      if (allowedUpdates.length === 0) return;
      onLayoutCommit(allowedUpdates);
    },
    [canEditLayout, onLayoutCommit, widgets, effectiveEditableById]
  );

  return (
    <div
      ref={containerRef}
      className="px-2 pb-24 sm:px-4"
      onPointerDownCapture={(event) => {
        if (!lockEnabled) return;
        if (!onReleaseAllWidgetLocks) return;

        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-widget-shell='true']")) return;

        onReleaseAllWidgetLocks();
      }}
    >
      {mounted && (
        <ReactGridLayout
          layout={renderedLayout}
          width={width}
          gridConfig={gridConfig}
          compactor={compactor}
          dragConfig={{
            cancel:
              "textarea, input, button, select, a, .overflow-auto, .overflow-scroll, .overflow-y-auto, .overflow-y-scroll, .overflow-x-auto, .overflow-x-scroll, .touch-pan-y, .touch-pan-x",
            enabled: canEditLayout,
          }}
          resizeConfig={{ enabled: canEditLayout }}
          onDragStop={handleLayoutCommit}
          onResizeStop={handleLayoutCommit}
        >
          {widgets.map((w) => {
            const canEdit = effectiveEditableById.get(w.id) ?? true;
            const canEditByPermission = permissionEditableById.get(w.id) ?? true;
            const lock = widgetLocks[w.id];
            const lockedByOther = lockEnabled && Boolean(lock && !lock.isMine);
            const entry = isAddableWidgetType(w.type)
              ? WidgetRegistry[w.type]
              : null;
            return (
              <div key={w.id} className="h-full" data-widget-shell="true">
                <div
                  className="relative h-full"
                  onPointerDownCapture={() => {
                    if (!lockEnabled) return;
                    if (!canEditByPermission) return;
                    if (lockedByOther) return;
                    onTouchWidgetLock?.(w.id);
                  }}
                  onFocusCapture={() => {
                    if (!lockEnabled) return;
                    if (!canEditByPermission) return;
                    if (lockedByOther) return;
                    onTouchWidgetLock?.(w.id);
                  }}
                >
                  <div
                    key={`${w.id}:${canEdit ? "edit" : "readonly"}`}
                    className={cn("h-full", widgetContentClassName)}
                  >
                    {entry ? entry.render({ widgetId: w.id, canEdit }) : null}
                  </div>
                  {lockEnabled && lock ? (
                    <>
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-0 rounded-lg border-2",
                          lock.isMine
                            ? "border-sky-400/80"
                            : "border-amber-400/90"
                        )}
                      />
                      <div
                        className={cn(
                          "pointer-events-none absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                          lock.isMine
                            ? "bg-sky-500/95 text-white"
                            : "bg-amber-500/95 text-white"
                        )}
                      >
                        {lock.isMine
                          ? t("수정 중", "Editing")
                          : `${lock.displayName} ${t("수정 중", "editing")}`}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}
