import Dexie, { Table } from "dexie";
import type {
  CalendarEvent,
  Dashboard,
  Dday,
  Id,
  ISODate,
  LocalPhoto,
  Member,
  Memo,
  Metric,
  MetricEntry,
  MigrationState,
  Mood,
  Notice,
  Todo,
  OutboxEvent,
  WeatherCache,
  Widget,
} from "./schema";

export function newId(): Id {
  return crypto.randomUUID();
}

export function nowIso(): ISODate {
  return new Date().toISOString();
}

export function getOrCreateLocalProfileId(): string {
  const KEY = "lifedashboard.localProfileId";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const v = crypto.randomUUID();
  localStorage.setItem(KEY, v);
  return v;
}

const LOCAL_MEMBERS_GROUP_PREFIX = "local:";

export function getLocalMembersGroupId(dashboardId: Id) {
  return `${LOCAL_MEMBERS_GROUP_PREFIX}${dashboardId}`;
}

export class LifeDashboardDB extends Dexie {
  dashboards!: Table<Dashboard, Id>;
  widgets!: Table<Widget, Id>;

  memos!: Table<Memo, Id>;
  todos!: Table<Todo, Id>;
  ddays!: Table<Dday, Id>;
  localPhotos!: Table<LocalPhoto, Id>;
  moods!: Table<Mood, Id>;
  notices!: Table<Notice, Id>;

  metrics!: Table<Metric, Id>;
  metricEntries!: Table<MetricEntry, Id>;

  calendarEvents!: Table<CalendarEvent, Id>;
  weatherCache!: Table<WeatherCache, Id>;

  members!: Table<Member, Id>;

  outbox!: Table<OutboxEvent, string>;

  migrationState!: Table<MigrationState, string>;

  constructor() {
    super("lifedashboard");

    const storesV1 = {
      dashboards: "id, name, ownerId, groupId, updatedAt",
      widgets:
        "id, dashboardId, type, createdBy, updatedAt, [dashboardId+type]",

      memos: "id, widgetId, dashboardId, updatedAt, [widgetId+updatedAt]",
      todos:
        "id, widgetId, dashboardId, date, done, order, [widgetId+date], [dashboardId+date]",
      localPhotos:
        "id, widgetId, dashboardId, takenAt, updatedAt, [widgetId+takenAt]",
      moods:
        "id, widgetId, dashboardId, date, [widgetId+date], [dashboardId+date]",
      notices:
        "id, widgetId, dashboardId, pinned, updatedAt, [widgetId+updatedAt]",

      metrics: "id, widgetId, dashboardId, name, updatedAt",
      metricEntries:
        "id, widgetId, dashboardId, metricId, date, [metricId+date], [widgetId+date]",

      calendarEvents:
        "id, widgetId, dashboardId, startAt, [widgetId+startAt], [dashboardId+startAt]",
      weatherCache:
        "id, widgetId, dashboardId, locationKey, fetchedAt, [widgetId+fetchedAt]",

      members: "id, groupId, role, displayName",

      migrationState: "id, status, migratedToUserId, updatedAt",
    };

    const storesV2 = {
      ...storesV1,
      ddays:
        "id, widgetId, dashboardId, date, updatedAt, [widgetId+date], [dashboardId+date]",
    };

    this.version(1).stores(storesV1);
    this.version(2).stores(storesV2);
    this.version(3).stores({
      ...storesV2,
      outbox:
        "id, entityType, entityId, dashboardId, widgetId, operation, updatedAt",
    });
  }
}

export const db = new LifeDashboardDB();
