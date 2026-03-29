import type { CreateWidgetPayload } from "@/shared/db/db";
import type { WidgetLayout, WidgetType } from "@/shared/db/schema";
import type { WidgetOption } from "@/feature/dashboard/types/widget";
import type { AppLanguage } from "@/shared/i18n/language";
import { createWidgetLayout, type LayoutItemSize } from "./layout";

type WidgetCreateContext = {
  existingLayouts: WidgetLayout[];
  language: AppLanguage;
};

type WidgetCreateResult = {
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  payload?: CreateWidgetPayload;
};

type WidgetRegistryEntry = WidgetOption & {
  create: (context: WidgetCreateContext) => WidgetCreateResult;
};

const createWithLayout =
  (
    preset: LayoutItemSize,
    extras:
      | Omit<WidgetCreateResult, "layout">
      | ((context: WidgetCreateContext) => Omit<WidgetCreateResult, "layout">) = {}
  ) =>
  (context: WidgetCreateContext): WidgetCreateResult => ({
    layout: createWidgetLayout(context.existingLayouts, preset),
    ...(typeof extras === "function" ? extras(context) : extras),
  });

const widgetRegistryEntries = [
  {
    type: "calendar",
    title: "Calendar",
    description: "View monthly schedules and events",
    create: createWithLayout({ w: 5, h: 13, minW: 4, minH: 12 }),
  },
  {
    type: "memo",
    title: "Memo",
    description: "Write quick notes",
    create: createWithLayout(
      { w: 3, h: 4, minW: 2, minH: 4 },
      { payload: { type: "memo", data: { text: "", color: undefined } } }
    ),
  },
  {
    type: "photo",
    title: "Photo",
    description: "Upload photos",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
  },
  {
    type: "todo",
    title: "Todo",
    description: "Track today's tasks",
    create: createWithLayout({ w: 3, h: 6, minW: 2, minH: 6 }),
  },
  {
    type: "dday",
    title: "D-Day",
    description: "Count down to your target date",
    create: createWithLayout({ w: 3, h: 6, minW: 2, minH: 6 }),
  },
  {
    type: "mood",
    title: "Mood",
    description: "Pick your current mood",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
  },
  {
    type: "chart",
    title: "Chart",
    description: "Track progress over time",
    create: createWithLayout(
      { w: 6, h: 9, minW: 4, minH: 8 },
      ({ language }) => ({
        settings: { isConfigured: false },
        payload: {
          type: "chart",
          data: {
            name: language === "ko" ? "차트" : "Metric",
            unit: undefined,
            chartType: "line",
          },
        },
      })
    ),
  },
  {
    type: "weather",
    title: "Weather",
    description: "Check this week's weather",
    create: createWithLayout({ w: 3, h: 5, minW: 2, minH: 5 }),
  },
  {
    type: "weeklySummary",
    title: "Weekly Summary",
    description: "Summarize the past week",
    create: createWithLayout(
      { w: 4, h: 6, minW: 3, minH: 6 },
      { settings: { summaryWeekday: 0 } }
    ),
  },
] as const satisfies ReadonlyArray<WidgetRegistryEntry>;

export type AddableWidgetType = (typeof widgetRegistryEntries)[number]["type"];

export const WidgetRegistry = widgetRegistryEntries.reduce<
  Record<AddableWidgetType, WidgetRegistryEntry>
>((registry, entry) => {
  registry[entry.type] = entry;
  return registry;
}, {} as Record<AddableWidgetType, WidgetRegistryEntry>);

export const widgetOptions = widgetRegistryEntries.map(
  ({ type, title, description }) => ({ type, title, description })
) satisfies WidgetOption[];

export const isAddableWidgetType = (
  type: WidgetType
): type is AddableWidgetType =>
  Object.prototype.hasOwnProperty.call(WidgetRegistry, type);
