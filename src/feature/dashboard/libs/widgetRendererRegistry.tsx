import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { Id } from "@/shared/db/schema";
import type { AddableWidgetType } from "@/feature/dashboard/libs/widgetRegistry";
import { CalendarWidget } from "@/feature/widgets/Calendar/components/CalendarWidget";
import { DdayWidget } from "@/feature/widgets/Dday/components/DdayWidget";
import { MemoWidget } from "@/feature/widgets/Memo/components/MemoWidget";
import { MoodWidget } from "@/feature/widgets/Mood/components/MoodWidget";
import { PhotoWidget } from "@/feature/widgets/Photo/components/PhotoWidget";
import { TodoWidget } from "@/feature/widgets/Todo/components/TodoWidget";

type WidgetRenderContext = {
  widgetId: Id;
  canEdit?: boolean;
};

type WidgetRendererEntry = {
  render: (context: WidgetRenderContext) => ReactNode;
};

function WidgetLoadingFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-full rounded-lg border border-border/70 bg-card/80"
    />
  );
}

const ChartWidget = dynamic(
  () =>
    import("@/feature/widgets/Chart/components/ChartWidget").then(
      (module) => module.ChartWidget
    ),
  {
    loading: () => <WidgetLoadingFallback />,
  }
);

const WeatherWidget = dynamic(
  () =>
    import("@/feature/widgets/Weather/components/WeatherWidget").then(
      (module) => module.WeatherWidget
    ),
  {
    loading: () => <WidgetLoadingFallback />,
  }
);

const WeeklySummaryWidget = dynamic(
  () =>
    import("@/feature/widgets/WeeklySummary/components/WeeklySummaryWidget").then(
      (module) => module.WeeklySummaryWidget
    ),
  {
    loading: () => <WidgetLoadingFallback />,
  }
);

const widgetRendererEntries = [
  {
    type: "calendar",
    render: ({ widgetId, canEdit }) => (
      <CalendarWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "memo",
    render: ({ widgetId, canEdit }) => (
      <MemoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "photo",
    render: ({ widgetId, canEdit }) => (
      <PhotoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "todo",
    render: ({ widgetId, canEdit }) => (
      <TodoWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "dday",
    render: ({ widgetId, canEdit }) => (
      <DdayWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "mood",
    render: ({ widgetId, canEdit }) => (
      <MoodWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "chart",
    render: ({ widgetId, canEdit }) => (
      <ChartWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "weather",
    render: ({ widgetId, canEdit }) => (
      <WeatherWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
  {
    type: "weeklySummary",
    render: ({ widgetId, canEdit }) => (
      <WeeklySummaryWidget widgetId={widgetId} canEdit={canEdit} />
    ),
  },
] as const satisfies ReadonlyArray<
  WidgetRendererEntry & { type: AddableWidgetType }
>;

export const WidgetRendererRegistry = widgetRendererEntries.reduce<
  Record<AddableWidgetType, WidgetRendererEntry>
>((registry, entry) => {
  registry[entry.type] = entry;
  return registry;
}, {} as Record<AddableWidgetType, WidgetRendererEntry>);
