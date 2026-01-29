import type { Layout } from "react-grid-layout";
import type { Widget, WidgetLayout } from "@/shared/db/schema";

export type LayoutItemSize = {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export function createWidgetLayout(
  existing: WidgetLayout[],
  layout: LayoutItemSize
): WidgetLayout {
  const bottom =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((l) => (l.y ?? 0) + (l.h ?? 0)));

  return {
    x: 0,
    y: bottom,
    ...layout,
  };
}

export function toGridLayout(widgets: Widget[]): Layout {
  return widgets.map((w) => ({ ...w.layout, i: w.id }));
}

function toWidgetLayout(
  item: Layout[number],
  current: WidgetLayout
): WidgetLayout {
  const next: WidgetLayout = {
    ...current,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  };

  if (item.minW !== undefined) next.minW = item.minW;
  if (item.minH !== undefined) next.minH = item.minH;
  if (item.maxW !== undefined) next.maxW = item.maxW;
  if (item.maxH !== undefined) next.maxH = item.maxH;
  if (item.static !== undefined) next.static = item.static;

  return next;
}

function isSameLayout(a: WidgetLayout, b: WidgetLayout): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.minW === b.minW &&
    a.minH === b.minH &&
    a.maxW === b.maxW &&
    a.maxH === b.maxH &&
    Boolean(a.static) === Boolean(b.static)
  );
}

export function applyGridLayout(
  widgets: Widget[],
  nextLayout: Layout
): Widget[] {
  const layoutById = new Map(nextLayout.map((item) => [item.i, item]));

  return widgets.map((w) => {
    const layout = layoutById.get(w.id);
    if (!layout) return w;

    const next = toWidgetLayout(layout, w.layout);
    if (isSameLayout(w.layout, next)) return w;

    return { ...w, layout: next };
  });
}

export function getLayoutUpdates(
  widgets: Widget[],
  nextLayout: Layout
): Widget[] {
  const layoutById = new Map(nextLayout.map((item) => [item.i, item]));
  const updates: Widget[] = [];

  for (const w of widgets) {
    const layout = layoutById.get(w.id);
    if (!layout) continue;

    const next = toWidgetLayout(layout, w.layout);
    if (isSameLayout(w.layout, next)) continue;

    updates.push({ ...w, layout: next });
  }

  return updates;
}
