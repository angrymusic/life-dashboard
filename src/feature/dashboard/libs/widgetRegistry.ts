import type { CreateWidgetPayload } from "@/shared/db/db";
import type { WidgetLayout } from "@/shared/db/schema";
import { createWidgetLayout, type LayoutItemSize } from "./layout";
import type { AddableWidgetType } from "./widgetOptions";

type WidgetCreateContext = {
  existingLayouts: WidgetLayout[];
};

type WidgetCreateResult = {
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  payload?: CreateWidgetPayload;
};

type WidgetRegistryEntry = {
  create: (context: WidgetCreateContext) => WidgetCreateResult;
};

const widgetLayoutPresets = {
  calendar: { w: 5, h: 12, minW: 5, minH: 12 },
  chart: { w: 5, h: 8, minW: 5, minH: 8 },
  dday: { w: 3, h: 6, minW: 3, minH: 6 },
  memo: { w: 3, h: 4, minW: 3, minH: 4 },
  mood: { w: 2, h: 5, minW: 2, minH: 5 },
  photo: { w: 2, h: 5, minW: 2, minH: 5 },
  todo: { w: 3, h: 6, minW: 3, minH: 6 },
  weather: { w: 3, h: 5, minW: 3, minH: 5 },
} satisfies Record<AddableWidgetType, LayoutItemSize>;

const createLayout = (
  existingLayouts: WidgetLayout[],
  type: AddableWidgetType
) => createWidgetLayout(existingLayouts, widgetLayoutPresets[type]);

export const WidgetRegistry = {
  calendar: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "calendar"),
    }),
  },
  chart: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "chart"),
      settings: { isConfigured: false },
      payload: {
        type: "chart",
        data: { name: "지표", unit: undefined, chartType: "line" },
      },
    }),
  },
  dday: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "dday"),
    }),
  },
  memo: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "memo"),
      payload: { type: "memo", data: { text: "", color: undefined } },
    }),
  },
  mood: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "mood"),
    }),
  },
  photo: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "photo"),
    }),
  },
  todo: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "todo"),
    }),
  },
  weather: {
    create: ({ existingLayouts }) => ({
      layout: createLayout(existingLayouts, "weather"),
    }),
  },
} satisfies Record<AddableWidgetType, WidgetRegistryEntry>;
