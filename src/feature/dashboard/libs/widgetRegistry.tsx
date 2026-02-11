import type { ReactNode } from "react";
import type { CreateWidgetPayload } from "@/shared/db/db";
import type { Id, WidgetLayout, WidgetType } from "@/shared/db/schema";
import type { WidgetOption } from "@/feature/dashboard/types/widget";
import { createWidgetLayout, type LayoutItemSize } from "./layout";
import { CalendarWidget } from "@/feature/widgets/Calendar/components/CalendarWidget";
import { ChartWidget } from "@/feature/widgets/Chart/components/ChartWidget";
import { DdayWidget } from "@/feature/widgets/Dday/components/DdayWidget";
import { MemoWidget } from "@/feature/widgets/Memo/components/MemoWidget";
import { MoodWidget } from "@/feature/widgets/Mood/components/MoodWidget";
import { PhotoWidget } from "@/feature/widgets/Photo/components/PhotoWidget";
import { TodoWidget } from "@/feature/widgets/Todo/components/TodoWidget";
import { WeatherWidget } from "@/feature/widgets/Weather/components/WeatherWidget";

type WidgetCreateContext = {
  existingLayouts: WidgetLayout[];
};

type WidgetCreateResult = {
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  payload?: CreateWidgetPayload;
};

type WidgetRenderContext = {
  widgetId: Id;
  canEdit?: boolean;
};

type WidgetRegistryEntry = WidgetOption & {
  create: (context: WidgetCreateContext) => WidgetCreateResult;
  render: (context: WidgetRenderContext) => ReactNode;
};

const createWithLayout =
  (preset: LayoutItemSize, extras: Omit<WidgetCreateResult, "layout"> = {}) =>
  ({ existingLayouts }: WidgetCreateContext): WidgetCreateResult => ({
    layout: createWidgetLayout(existingLayouts, preset),
    ...extras,
  });

const widgetRegistryEntries = [
  {
    type: "calendar",
    title: "Calendar",
    description: "View monthly schedules and events",
    create: createWithLayout({ w: 5, h: 13, minW: 5, minH: 12 }),
    render: ({ widgetId, canEdit }) => (
      <CalendarWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "memo",
    title: "Memo",
    description: "Write quick notes",
    create: createWithLayout(
      { w: 3, h: 4, minW: 3, minH: 4 },
      { payload: { type: "memo", data: { text: "", color: undefined } } }
    ),
    render: ({ widgetId, canEdit }) => (
      <MemoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "photo",
    title: "Photo",
    description: "Upload photos",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
    render: ({ widgetId, canEdit }) => (
      <PhotoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "todo",
    title: "Todo",
    description: "Track today's tasks",
    create: createWithLayout({ w: 3, h: 6, minW: 3, minH: 6 }),
    render: ({ widgetId, canEdit }) => (
      <TodoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "dday",
    title: "D-Day",
    description: "Count down to your target date",
    create: createWithLayout({ w: 3, h: 6, minW: 3, minH: 6 }),
    render: ({ widgetId, canEdit }) => (
      <DdayWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "mood",
    title: "Mood",
    description: "Pick your current mood",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
    render: ({ widgetId, canEdit }) => (
      <MoodWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "chart",
    title: "Chart",
    description: "Track progress over time",
    create: createWithLayout(
      { w: 6, h: 9, minW: 5, minH: 8 },
      {
        settings: { isConfigured: false },
        payload: {
          type: "chart",
          data: { name: "Metric", unit: undefined, chartType: "line" },
        },
      }
    ),
    render: ({ widgetId, canEdit }) => (
      <ChartWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "weather",
    title: "Weather",
    description: "Check this week's weather",
    create: createWithLayout({ w: 3, h: 5, minW: 3, minH: 5 }),
    render: ({ widgetId, canEdit }) => (
      <WeatherWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
] as const satisfies ReadonlyArray<WidgetRegistryEntry>;

export type AddableWidgetType = (typeof widgetRegistryEntries)[number]["type"];

export const WidgetRegistry = Object.fromEntries(
  widgetRegistryEntries.map((entry) => [entry.type, entry])
) as Record<AddableWidgetType, WidgetRegistryEntry>;

export const widgetOptions = widgetRegistryEntries.map(
  ({ type, title, description }) => ({ type, title, description })
) satisfies WidgetOption[];

export const isAddableWidgetType = (
  type: WidgetType
): type is AddableWidgetType =>
  Object.prototype.hasOwnProperty.call(WidgetRegistry, type);
