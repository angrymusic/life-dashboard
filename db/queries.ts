// src/db/queries.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Id, YMD } from "./schema";

/** 대시보드 목록 */
export function useDashboards() {
  return useLiveQuery(
    async () => db.dashboards.orderBy("updatedAt").reverse().toArray(),
    []
  );
}

/** 특정 대시보드의 위젯 메타 목록 */
export function useDashboardWidgets(dashboardId: Id) {
  return useLiveQuery(
    async () => db.widgets.where("dashboardId").equals(dashboardId).toArray(),
    [dashboardId]
  );
}

/** 위젯 단건 */
export function useWidget(widgetId: Id) {
  return useLiveQuery(async () => db.widgets.get(widgetId), [widgetId]);
}

/** memo 위젯 데이터 */
export function useMemos(widgetId: Id) {
  return useLiveQuery(
    async () => db.memos.where("widgetId").equals(widgetId).sortBy("updatedAt"),
    [widgetId]
  );
}

/** todo: 위젯 + 날짜 */
export function useTodosByDate(widgetId: Id, date: YMD) {
  return useLiveQuery(
    async () =>
      db.todos
        .where("[widgetId+date]")
        .equals([widgetId, date])
        .sortBy("order"),
    [widgetId, date]
  );
}

/** photo: 로컬 사진(Blob 포함) */
export function useLocalPhotos(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.localPhotos
        .where("widgetId")
        .equals(widgetId)
        .reverse()
        .sortBy("takenAt"),
    [widgetId]
  );
}

/** mood: 날짜별 */
export function useMoodsByDate(widgetId: Id, date: YMD) {
  return useLiveQuery(
    async () =>
      db.moods.where("[widgetId+date]").equals([widgetId, date]).toArray(),
    [widgetId, date]
  );
}

/** notice */
export function useNotices(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.notices
        .where("widgetId")
        .equals(widgetId)
        .reverse()
        .sortBy("updatedAt"),
    [widgetId]
  );
}

/** chart: metric(지표 정의) */
export function useMetrics(widgetId: Id) {
  return useLiveQuery(
    async () => db.metrics.where("widgetId").equals(widgetId).toArray(),
    [widgetId]
  );
}

/** chart: metric entries */
export function useMetricEntries(metricId: Id) {
  return useLiveQuery(
    async () =>
      db.metricEntries.where("metricId").equals(metricId).sortBy("date"),
    [metricId]
  );
}

/** calendar events */
export function useCalendarEvents(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.calendarEvents.where("widgetId").equals(widgetId).sortBy("startAt"),
    [widgetId]
  );
}

/** weather cache */
export function useWeatherCache(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.weatherCache
        .where("widgetId")
        .equals(widgetId)
        .reverse()
        .sortBy("fetchedAt"),
    [widgetId]
  );
}

/** migration state */
export function useMigrationState(localProfileId: string) {
  return useLiveQuery(
    async () => db.migrationState.get(localProfileId),
    [localProfileId]
  );
}
