// src/db/queries.ts
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Id, YMD } from "./schema";

/** 대시보드 목록 */
export function useDashboards() {
  return useLiveQuery(
    async () => {
      const dashboards = await db.dashboards.toArray();
      return dashboards.sort((a, b) => {
        const aTime = a.createdAt ?? a.updatedAt ?? "";
        const bTime = b.createdAt ?? b.updatedAt ?? "";
        const diff = aTime.localeCompare(bTime);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
    },
    []
  );
}

/** 특정 대시보드의 위젯 메타 목록 */
export function useDashboardWidgets(dashboardId?: Id) {
  return useLiveQuery(
    async () => {
      if (!dashboardId) return undefined;
      return db.widgets.where("dashboardId").equals(dashboardId).toArray();
    },
    [dashboardId]
  );
}

/** 위젯 단건 */
export function useWidget(widgetId: Id) {
  return useLiveQuery(async () => db.widgets.get(widgetId), [widgetId]);
}

/** memo 위젯 데이터 */
export function useMemoOne(widgetId: Id) {
  return useLiveQuery(
    () => db.memos.where("widgetId").equals(widgetId).first(),
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
        .toArray(),
    [widgetId, date]
  );
}

/** dday: 위젯별 */
export function useDdays(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.ddays
        .where("[widgetId+date]")
        .between([widgetId, Dexie.minKey], [widgetId, Dexie.maxKey])
        .toArray(),
    [widgetId]
  );
}

/** photo: 로컬 사진(Blob 포함) */
export function useLocalPhotos(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.localPhotos
        .where("[widgetId+takenAt]")
        .between([widgetId, Dexie.minKey], [widgetId, Dexie.maxKey])
        .toArray(),
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
        .where("[widgetId+updatedAt]")
        .between([widgetId, Dexie.minKey], [widgetId, Dexie.maxKey])
        .toArray(),
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
      db.metricEntries
        .where("[metricId+date]")
        .between([metricId, Dexie.minKey], [metricId, Dexie.maxKey])
        .toArray(),
    [metricId]
  );
}

/** calendar events */
export function useCalendarEvents(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.calendarEvents
        .where("[widgetId+startAt]")
        .between([widgetId, Dexie.minKey], [widgetId, Dexie.maxKey])
        .toArray(),
    [widgetId]
  );
}

/** weather cache (latest entry only) */
export function useWeatherCache(widgetId: Id) {
  return useLiveQuery(
    async () =>
      db.weatherCache
        .where("[widgetId+fetchedAt]")
        .between([widgetId, Dexie.minKey], [widgetId, Dexie.maxKey])
        .last(),
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

/** members */
export function useMembers() {
  return useLiveQuery(async () => db.members.toArray(), []);
}

/** outbox count */
export function useOutboxCount() {
  return useLiveQuery(async () => db.outbox.count(), []);
}
