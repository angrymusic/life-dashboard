// src/db/db.ts
import Dexie, { Table } from "dexie";
import type {
  Id,
  ISODate,
  YMD,
  WidgetType,
  WidgetLayout,
  Dashboard,
  Widget,
  Memo,
  Todo,
  LocalPhoto,
  Mood,
  Notice,
  Metric,
  MetricEntry,
  CalendarEvent,
  WeatherCache,
  Member,
  MigrationState,
  LocalSnapshot,
} from "./schema";

/** id 생성: 로컬에서 만든 id를 서버 PK로 그대로 쓰기 위함 */
export function newId(): Id {
  return crypto.randomUUID();
}
export function nowIso(): ISODate {
  return new Date().toISOString();
}

/** 로컬 프로필 id: 브라우저/프로필 단위로 한 번 생성해서 유지 */
export function getOrCreateLocalProfileId(): string {
  const KEY = "lifedashboard.localProfileId";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const v = crypto.randomUUID();
  localStorage.setItem(KEY, v);
  return v;
}

/** 위젯 생성 시 필요한 최소 payload 타입 */
export type CreateWidgetPayload =
  | { type: "memo"; data: Pick<Memo, "text" | "color"> }
  | { type: "todo"; data: Pick<Todo, "date" | "title" | "done" | "order"> }
  | {
      type: "photo";
      data: Pick<LocalPhoto, "blob" | "mimeType" | "caption" | "takenAt">;
    }
  | { type: "mood"; data: Pick<Mood, "date" | "mood" | "note"> }
  | { type: "notice"; data: Pick<Notice, "title" | "body" | "pinned"> }
  | { type: "chart"; data: Pick<Metric, "name" | "unit" | "chartType"> }
  | {
      type: "calendar";
      data: Pick<
        CalendarEvent,
        "title" | "startAt" | "endAt" | "allDay" | "location" | "description"
      >;
    }
  | {
      type: "weather";
      data: Pick<WeatherCache, "locationKey" | "payload" | "fetchedAt">;
    };

export class LifeDashboardDB extends Dexie {
  dashboards!: Table<Dashboard, Id>;
  widgets!: Table<Widget, Id>;

  memos!: Table<Memo, Id>;
  todos!: Table<Todo, Id>;
  localPhotos!: Table<LocalPhoto, Id>;
  moods!: Table<Mood, Id>;
  notices!: Table<Notice, Id>;

  metrics!: Table<Metric, Id>;
  metricEntries!: Table<MetricEntry, Id>;

  calendarEvents!: Table<CalendarEvent, Id>;
  weatherCache!: Table<WeatherCache, Id>;

  members!: Table<Member, Id>;

  /** outbox 대신: 마이그레이션 상태만 관리 */
  migrationState!: Table<MigrationState, string>;

  constructor() {
    super("lifedashboard");

    this.version(1).stores({
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
    });
  }
}

export const db = new LifeDashboardDB();

/** =========================
 *  Dashboard helpers
 *  ========================= */

export async function createDashboard(params: {
  name: string;
  ownerId?: Id;
  groupId?: Id;
}) {
  const now = nowIso();
  const dashboard: Dashboard = {
    id: newId(),
    name: params.name,
    ownerId: params.ownerId,
    groupId: params.groupId,
    createdAt: now,
    updatedAt: now,
  };
  await db.dashboards.add(dashboard);
  return dashboard.id;
}

/** =========================
 *  Widget CRUD (Local mode)
 *  ========================= */

/**
 * 위젯 추가(트랜잭션)
 * - widgets 메타 + 타입별 데이터 insert
 * - outbox 없음(로그인 시점 export/import가 전부)
 */
export async function addWidget(params: {
  dashboardId: Id;
  type: WidgetType;
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  createdBy?: Id;
  payload?: CreateWidgetPayload;
}) {
  const now = nowIso();
  const widgetId = newId();

  const widget: Widget = {
    id: widgetId,
    dashboardId: params.dashboardId,
    type: params.type,
    layout: params.layout,
    settings: params.settings,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(
    "rw",
    [
      db.widgets,
      db.memos,
      db.todos,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
    ],
    async () => {
      await db.widgets.add(widget);

      const p = params.payload;
      if (!p) return;

      if (p.type === "memo") {
        const memo: Memo = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          text: p.data.text,
          color: p.data.color,
          createdAt: now,
          updatedAt: now,
        };
        await db.memos.add(memo);
      }

      if (p.type === "todo") {
        const todo: Todo = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          date: p.data.date as YMD,
          title: p.data.title,
          done: p.data.done ?? false,
          order: p.data.order,
          createdAt: now,
          updatedAt: now,
        };
        await db.todos.add(todo);
      }

      if (p.type === "photo") {
        const lp: LocalPhoto = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          blob: p.data.blob,
          mimeType: p.data.mimeType,
          caption: p.data.caption,
          takenAt: p.data.takenAt,
          createdAt: now,
          updatedAt: now,
        };
        await db.localPhotos.add(lp);
      }

      if (p.type === "mood") {
        const mood: Mood = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          date: p.data.date as YMD,
          mood: p.data.mood,
          note: p.data.note,
          createdAt: now,
          updatedAt: now,
        };
        await db.moods.add(mood);
      }

      if (p.type === "notice") {
        const notice: Notice = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          title: p.data.title,
          body: p.data.body,
          pinned: p.data.pinned,
          createdAt: now,
          updatedAt: now,
        };
        await db.notices.add(notice);
      }

      if (p.type === "chart") {
        // chart 위젯 1개 생성 시, 보통 metric 1개를 함께 생성(지표 정의)
        const metric: Metric = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          name: p.data.name,
          unit: p.data.unit,
          chartType: p.data.chartType,
          createdAt: now,
          updatedAt: now,
        };
        await db.metrics.add(metric);
      }

      if (p.type === "calendar") {
        const ev: CalendarEvent = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          title: p.data.title,
          startAt: p.data.startAt,
          endAt: p.data.endAt,
          allDay: p.data.allDay,
          location: p.data.location,
          description: p.data.description,
          createdAt: now,
          updatedAt: now,
        };
        await db.calendarEvents.add(ev);
      }

      if (p.type === "weather") {
        const wc: WeatherCache = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          locationKey: p.data.locationKey,
          payload: p.data.payload,
          fetchedAt: p.data.fetchedAt ?? now,
        };
        await db.weatherCache.add(wc);
      }
    }
  );

  return widgetId;
}

export async function updateWidgetLayout(widgetId: Id, layout: WidgetLayout) {
  const now = nowIso();
  await db.widgets.update(widgetId, { layout, updatedAt: now });
}

export async function updateWidgetSettings(
  widgetId: Id,
  settings: Record<string, unknown>
) {
  const now = nowIso();
  await db.widgets.update(widgetId, { settings, updatedAt: now });
}

/**
 * 위젯 삭제(cascade)
 * - widget 삭제 시, 해당 위젯 타입의 데이터도 같이 삭제
 * - 서버는 로그인 이후 서버 저장만 쓰므로, 로컬 삭제는 로컬 모드에서만 의미 있음
 */
export async function deleteWidgetCascade(widgetId: Id) {
  const widget = await db.widgets.get(widgetId);
  if (!widget) return;

  await db.transaction(
    "rw",
    [
      db.widgets,
      db.memos,
      db.todos,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
    ],
    async () => {
      if (widget.type === "memo")
        await db.memos.where("widgetId").equals(widgetId).delete();
      if (widget.type === "todo")
        await db.todos.where("widgetId").equals(widgetId).delete();
      if (widget.type === "photo")
        await db.localPhotos.where("widgetId").equals(widgetId).delete();
      if (widget.type === "mood")
        await db.moods.where("widgetId").equals(widgetId).delete();
      if (widget.type === "notice")
        await db.notices.where("widgetId").equals(widgetId).delete();

      if (widget.type === "chart") {
        // metric + metricEntries
        const metrics = await db.metrics
          .where("widgetId")
          .equals(widgetId)
          .toArray();
        const metricIds = metrics.map((m) => m.id);
        await db.metrics.where("widgetId").equals(widgetId).delete();
        if (metricIds.length) {
          await db.metricEntries.where("metricId").anyOf(metricIds).delete();
        }
      }

      if (widget.type === "calendar")
        await db.calendarEvents.where("widgetId").equals(widgetId).delete();
      if (widget.type === "weather")
        await db.weatherCache.where("widgetId").equals(widgetId).delete();

      await db.widgets.delete(widgetId);
    }
  );
}

/** =========================
 *  Snapshot export (Login 순간 업로드용)
 *  ========================= */

/**
 * 로컬 DB의 "최종 상태 스냅샷"을 한번에 뽑는다.
 * - 로그인 성공 시 서버로 올릴 payload의 기반
 * - photo는 Blob(localPhotos)로 포함되므로 서버 업로드 과정에서 따로 처리 필요
 */
export async function exportLocalSnapshot(): Promise<LocalSnapshot> {
  const [
    dashboards,
    widgets,
    memos,
    todos,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
    members,
  ] = await Promise.all([
    db.dashboards.toArray(),
    db.widgets.toArray(),

    db.memos.toArray(),
    db.todos.toArray(),
    db.moods.toArray(),
    db.notices.toArray(),

    db.metrics.toArray(),
    db.metricEntries.toArray(),

    db.calendarEvents.toArray(),
    db.weatherCache.toArray(),

    db.localPhotos.toArray(),
    db.members.toArray(),
  ]);

  return {
    dashboards,
    widgets,
    memos,
    todos,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
    members,
  };
}

/** =========================
 *  MigrationState helpers
 *  ========================= */

export async function getMigrationState() {
  const localProfileId = getOrCreateLocalProfileId();
  return db.migrationState.get(localProfileId);
}

export async function setMigrationState(
  partial: Omit<MigrationState, "id" | "updatedAt">
) {
  const localProfileId = getOrCreateLocalProfileId();
  const updatedAt = nowIso();
  await db.migrationState.put({ id: localProfileId, ...partial, updatedAt });
}

/**
 * (선택) 로컬 DB 초기화
 * - "클라우드 모드 전용으로 전환" UX를 원하면, 마이그레이션 성공 후 로컬을 비우는 버튼 제공
 * - 로컬 모드 계속 사용도 허용할 거면, 이건 자동으로 하지 말고 사용자 선택으로 두는 걸 추천
 */
export async function clearLocalDataExceptMigrationState() {
  await db.transaction(
    "rw",
    [
      db.dashboards,
      db.widgets,
      db.memos,
      db.todos,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
      db.members,
    ],
    async () => {
      await Promise.all([
        db.dashboards.clear(),
        db.widgets.clear(),
        db.memos.clear(),
        db.todos.clear(),
        db.localPhotos.clear(),
        db.moods.clear(),
        db.notices.clear(),
        db.metrics.clear(),
        db.metricEntries.clear(),
        db.calendarEvents.clear(),
        db.weatherCache.clear(),
        db.members.clear(),
      ]);
    }
  );
}
