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

export function applyGridLayout(
  widgets: Widget[],
  nextLayout: Layout
): Widget[] {
  const layoutById = new Map(nextLayout.map((item) => [item.i, item]));

  return widgets.map((w) => {
    const layout = layoutById.get(w.id);
    if (!layout) return w;

    const { i: _i, ...layoutWithoutI } = layout;

    return { ...w, layout: layoutWithoutI };
  });
}
