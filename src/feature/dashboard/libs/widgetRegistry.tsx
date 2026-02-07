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
    title: "달력",
    description: "월간 일정과 이벤트를 확인해요",
    create: createWithLayout({ w: 5, h: 13, minW: 5, minH: 12 }),
    render: ({ widgetId, canEdit }) => (
      <CalendarWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "memo",
    title: "메모",
    description: "간단한 메모를 적어요",
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
    title: "사진",
    description: "사진을 올려요",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
    render: ({ widgetId, canEdit }) => (
      <PhotoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "todo",
    title: "할 일",
    description: "오늘 할 일을 체크해요",
    create: createWithLayout({ w: 3, h: 6, minW: 3, minH: 6 }),
    render: ({ widgetId, canEdit }) => (
      <TodoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "dday",
    title: "디데이",
    description: "목표일까지 남은 날짜를 확인해요",
    create: createWithLayout({ w: 3, h: 6, minW: 3, minH: 6 }),
    render: ({ widgetId, canEdit }) => (
      <DdayWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "mood",
    title: "기분",
    description: "현재 기분을 골라요",
    create: createWithLayout({ w: 2, h: 5, minW: 2, minH: 5 }),
    render: ({ widgetId, canEdit }) => (
      <MoodWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "chart",
    title: "차트",
    description: "목표 진행을 시간 순으로 기록해요",
    create: createWithLayout(
      { w: 6, h: 9, minW: 5, minH: 8 },
      {
        settings: { isConfigured: false },
        payload: {
          type: "chart",
          data: { name: "지표", unit: undefined, chartType: "line" },
        },
      }
    ),
    render: ({ widgetId, canEdit }) => (
      <ChartWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "weather",
    title: "날씨",
    description: "이번 주 날씨를 확인해요",
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
