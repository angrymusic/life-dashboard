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
  Dday,
  Photo,
  LocalPhoto,
  Mood,
  Notice,
  Metric,
  MetricEntry,
  CalendarEvent,
  WeatherCache,
  Member,
  OutboxEvent,
  OutboxEntityType,
  OutboxOperation,
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

const LOCAL_MEMBERS_GROUP_PREFIX = "local:";

export function getLocalMembersGroupId(dashboardId: Id) {
  return `${LOCAL_MEMBERS_GROUP_PREFIX}${dashboardId}`;
}

type LocalOwnerProfile = {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  userId?: Id;
};

function buildLocalOwnerMember(
  dashboardId: Id,
  profile: LocalOwnerProfile,
  now: ISODate
): Member {
  const email = profile.email?.trim() || undefined;
  const displayName = profile.displayName?.trim() || email || "사용자";
  const groupId = getLocalMembersGroupId(dashboardId);
  return {
    id: `${groupId}:owner`,
    groupId,
    role: "parent",
    displayName,
    avatarUrl: profile.avatarUrl ?? undefined,
    email,
    userId: profile.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/** 위젯 생성 시 필요한 최소 payload 타입 */
export type CreateWidgetPayload =
  | { type: "memo"; data: Pick<Memo, "text" | "color"> }
  | { type: "todo"; data: Pick<Todo, "date" | "title" | "done" | "order"> }
  | { type: "dday"; data: Pick<Dday, "title" | "date" | "color"> }
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
        | "title"
        | "startAt"
        | "endAt"
        | "allDay"
        | "location"
        | "description"
        | "color"
        | "recurrence"
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

  /** 마이그레이션 상태 */
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

type WriteOptions = {
  skipOutbox?: boolean;
};

type OutboxRecord = {
  id?: unknown;
  dashboardId?: unknown;
  widgetId?: unknown;
};

function buildOutboxId(entityType: OutboxEntityType, entityId: Id) {
  // Stable key to coalesce frequent updates per entity.
  return `${entityType}:${entityId}`;
}

function getRecordString(record: OutboxRecord, key: keyof OutboxRecord) {
  const value = record[key];
  return typeof value === "string" ? (value as Id) : undefined;
}

function toPayload(record: OutboxRecord) {
  return record as Record<string, unknown>;
}

function sanitizeOutboxPayload(
  entityType: OutboxEntityType,
  record: OutboxRecord
) {
  const payload = toPayload(record);
  if (entityType === "localPhoto" && "blob" in payload) {
    const { blob: _blob, ...rest } = payload;
    return rest;
  }
  return payload;
}

function resolveOutboxScope(
  entityType: OutboxEntityType,
  record: OutboxRecord
) {
  const dashboardId =
    getRecordString(record, "dashboardId") ??
    (entityType === "dashboard"
      ? getRecordString(record, "id")
      : undefined);
  const widgetId =
    getRecordString(record, "widgetId") ??
    (entityType === "widget"
      ? getRecordString(record, "id")
      : undefined);
  return { dashboardId, widgetId };
}

function buildOutboxEvent(params: {
  entityType: OutboxEntityType;
  entityId: Id;
  operation: OutboxOperation;
  payload?: Record<string, unknown>;
  dashboardId?: Id;
  widgetId?: Id;
  now?: ISODate;
}): OutboxEvent {
  const now = params.now ?? nowIso();
  return {
    id: buildOutboxId(params.entityType, params.entityId),
    entityType: params.entityType,
    entityId: params.entityId,
    dashboardId: params.dashboardId,
    widgetId: params.widgetId,
    operation: params.operation,
    payload: params.payload,
    createdAt: now,
    updatedAt: now,
  };
}

async function recordOutboxUpsert(params: {
  entityType: OutboxEntityType;
  record: OutboxRecord;
  options?: WriteOptions;
  now?: ISODate;
}) {
  if (params.options?.skipOutbox) return;
  const entityId = getRecordString(params.record, "id");
  if (!entityId) return;
  const scope = resolveOutboxScope(params.entityType, params.record);
  const payload = sanitizeOutboxPayload(params.entityType, params.record);
  const event = buildOutboxEvent({
    entityType: params.entityType,
    entityId,
    operation: "upsert",
    payload,
    dashboardId: scope.dashboardId,
    widgetId: scope.widgetId,
    now: params.now,
  });
  await db.outbox.put(event);
}

async function recordOutboxUpsertMany(params: {
  entityType: OutboxEntityType;
  records: OutboxRecord[];
  options?: WriteOptions;
  now?: ISODate;
}) {
  if (params.options?.skipOutbox) return;
  if (params.records.length === 0) return;
  const now = params.now ?? nowIso();
  const events = params.records
    .map((record) => {
      const entityId = getRecordString(record, "id");
      if (!entityId) return null;
      const scope = resolveOutboxScope(params.entityType, record);
      return buildOutboxEvent({
        entityType: params.entityType,
        entityId,
        operation: "upsert",
        payload: sanitizeOutboxPayload(params.entityType, record),
        dashboardId: scope.dashboardId,
        widgetId: scope.widgetId,
        now,
      });
    })
    .filter((event): event is OutboxEvent => Boolean(event));
  if (events.length) {
    await db.outbox.bulkPut(events);
  }
}

async function recordOutboxDelete(params: {
  entityType: OutboxEntityType;
  entityId: Id;
  dashboardId?: Id;
  widgetId?: Id;
  options?: WriteOptions;
  now?: ISODate;
}) {
  if (params.options?.skipOutbox) return;
  const event = buildOutboxEvent({
    entityType: params.entityType,
    entityId: params.entityId,
    operation: "delete",
    dashboardId: params.dashboardId,
    widgetId: params.widgetId,
    now: params.now,
  });
  await db.outbox.put(event);
}

async function recordOutboxDeleteMany(params: {
  entityType: OutboxEntityType;
  records: OutboxRecord[];
  options?: WriteOptions;
  now?: ISODate;
}) {
  if (params.options?.skipOutbox) return;
  if (params.records.length === 0) return;
  const now = params.now ?? nowIso();
  const events = params.records
    .map((record) => {
      const entityId = getRecordString(record, "id");
      if (!entityId) return null;
      const scope = resolveOutboxScope(params.entityType, record);
      return buildOutboxEvent({
        entityType: params.entityType,
        entityId,
        operation: "delete",
        dashboardId: scope.dashboardId,
        widgetId: scope.widgetId,
        now,
      });
    })
    .filter((event): event is OutboxEvent => Boolean(event));
  if (events.length) {
    await db.outbox.bulkPut(events);
  }
}

function buildUpsertEventForRecord(
  entityType: OutboxEntityType,
  record: OutboxRecord,
  now?: ISODate
) {
  const entityId = getRecordString(record, "id");
  if (!entityId) return null;
  const scope = resolveOutboxScope(entityType, record);
  return buildOutboxEvent({
    entityType,
    entityId,
    operation: "upsert",
    payload: sanitizeOutboxPayload(entityType, record),
    dashboardId: scope.dashboardId,
    widgetId: scope.widgetId,
    now,
  });
}

function buildDeleteEventForRecord(
  entityType: OutboxEntityType,
  record: OutboxRecord,
  now?: ISODate
) {
  const entityId = getRecordString(record, "id");
  if (!entityId) return null;
  const scope = resolveOutboxScope(entityType, record);
  return buildOutboxEvent({
    entityType,
    entityId,
    operation: "delete",
    dashboardId: scope.dashboardId,
    widgetId: scope.widgetId,
    now,
  });
}

async function isSharedDashboard(dashboardId: Id) {
  const dashboard = await db.dashboards.get(dashboardId);
  return Boolean(dashboard?.groupId);
}

async function resolveWritePolicy(dashboardId: Id, options?: WriteOptions) {
  const shared = await isSharedDashboard(dashboardId);
  const skipOutbox = Boolean(options?.skipOutbox || shared);
  const syncToServer = Boolean(shared && !options?.skipOutbox);
  return { shared, skipOutbox, syncToServer };
}

function sortOutboxEvents(events: OutboxEvent[]) {
  const priority = new Map<OutboxEntityType, number>([
    ["dashboard", 0],
    ["widget", 1],
    ["metric", 2],
    ["metricEntry", 3],
    ["memo", 4],
    ["todo", 5],
    ["dday", 6],
    ["mood", 7],
    ["notice", 8],
    ["calendarEvent", 9],
    ["weatherCache", 10],
    ["localPhoto", 11],
    ["photo", 12],
  ]);
  return [...events].sort((a, b) => {
    const pa = priority.get(a.entityType) ?? 100;
    const pb = priority.get(b.entityType) ?? 100;
    if (pa !== pb) return pa - pb;
    return a.updatedAt.localeCompare(b.updatedAt);
  });
}

type ServerSyncResponse = {
  ok: boolean;
  appliedIds: string[];
  errors?: { id: string; error: string }[];
};

async function applyEventsToServer(events: OutboxEvent[]) {
  if (events.length === 0) {
    return { ok: true, appliedIds: [] } satisfies ServerSyncResponse;
  }
  const response = await fetch("/api/sync/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  const payload = (await response.json()) as ServerSyncResponse | null;
  if (!payload) {
    throw new Error("Server sync failed");
  }
  if (!response.ok && !payload.appliedIds) {
    throw new Error("Server sync failed");
  }
  return payload;
}

async function uploadPhotoFile(file: Blob, mimeType: string) {
  const uploadFile =
    file instanceof File
      ? file
      : new File([file], `photo-${crypto.randomUUID()}`, { type: mimeType });
  const form = new FormData();
  form.append("file", uploadFile);

  const response = await fetch("/api/migrate/upload-photo", {
    method: "POST",
    body: form,
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    storagePath?: string;
    mimeType?: string;
  };
  if (!response.ok || !payload.ok || !payload.storagePath) {
    throw new Error("Photo upload failed");
  }
  return { storagePath: payload.storagePath, mimeType: payload.mimeType };
}

function toPhotoRecord(localPhoto: LocalPhoto, storagePath: string): Photo {
  return {
    id: localPhoto.id,
    widgetId: localPhoto.widgetId,
    dashboardId: localPhoto.dashboardId,
    storagePath,
    mimeType: localPhoto.mimeType,
    caption: localPhoto.caption,
    takenAt: localPhoto.takenAt,
    createdAt: localPhoto.createdAt,
    updatedAt: localPhoto.updatedAt,
  };
}

async function ensureServerStoragePath(localPhoto: LocalPhoto) {
  if (localPhoto.serverStoragePath) {
    return localPhoto.serverStoragePath;
  }
  if (!localPhoto.blob) {
    throw new Error("Missing local photo blob");
  }
  const { storagePath } = await uploadPhotoFile(
    localPhoto.blob,
    localPhoto.mimeType
  );
  await db.localPhotos.update(localPhoto.id, {
    serverStoragePath: storagePath,
  });
  return storagePath;
}

/** =========================
 *  Dashboard helpers
 *  ========================= */

export async function createDashboard(params: {
  name: string;
  ownerId?: Id;
  groupId?: Id;
  ownerProfile?: LocalOwnerProfile;
}, options: WriteOptions = {}) {
  const now = nowIso();
  const dashboard: Dashboard = {
    id: newId(),
    name: params.name,
    ownerId: params.ownerId,
    groupId: params.groupId,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.dashboards, db.outbox, db.members], async () => {
    await db.dashboards.add(dashboard);
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: dashboard,
      options,
      now,
    });
    if (!params.groupId) {
      const ownerProfile = params.ownerProfile ?? {};
      await db.members.put(
        buildLocalOwnerMember(
          dashboard.id,
          { ...ownerProfile, userId: ownerProfile.userId ?? params.ownerId },
          now
        )
      );
    }
  });
  return dashboard.id;
}

export async function ensureDefaultDashboard(params: {
  name: string;
  ownerId?: Id;
  ownerProfile?: LocalOwnerProfile;
}) {
  let createdId: Id | null = null;
  await db.transaction("rw", [db.dashboards, db.outbox, db.members], async () => {
    const count = await db.dashboards.count();
    if (count > 0) return;
    const now = nowIso();
    const dashboard: Dashboard = {
      id: newId(),
      name: params.name,
      ownerId: params.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    await db.dashboards.add(dashboard);
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: dashboard,
      now,
    });
    const ownerProfile = params.ownerProfile ?? {};
    await db.members.put(
      buildLocalOwnerMember(
        dashboard.id,
        { ...ownerProfile, userId: ownerProfile.userId ?? params.ownerId },
        now
      )
    );
    createdId = dashboard.id;
  });
  return createdId;
}

export async function updateDashboardName(
  dashboardId: Id,
  name: string,
  options: WriteOptions = {}
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await db.dashboards.get(dashboardId);
  if (!existing) return;
  if (existing.name === trimmed) return;
  const policy = await resolveWritePolicy(dashboardId, options);
  const now = nowIso();
  const nextDashboard: Dashboard = {
    ...existing,
    name: trimmed,
    updatedAt: now,
  };
  await db.transaction("rw", [db.dashboards, db.outbox], async () => {
    await db.dashboards.update(dashboardId, {
      name: trimmed,
      updatedAt: now,
    });
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: nextDashboard,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("dashboard", nextDashboard, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteDashboardCascade(
  dashboardId: Id,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(dashboardId, options);
  await db.transaction(
    "rw",
    [
      db.dashboards,
      db.widgets,
      db.memos,
      db.todos,
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
      db.members,
      db.outbox,
    ],
    async () => {
      await db.outbox.where("dashboardId").equals(dashboardId).delete();
      await db.members
        .where("groupId")
        .equals(getLocalMembersGroupId(dashboardId))
        .delete();
      await Promise.all([
        db.widgets.where("dashboardId").equals(dashboardId).delete(),
        db.memos.where("dashboardId").equals(dashboardId).delete(),
        db.todos.where("dashboardId").equals(dashboardId).delete(),
        db.ddays.where("dashboardId").equals(dashboardId).delete(),
        db.localPhotos.where("dashboardId").equals(dashboardId).delete(),
        db.moods.where("dashboardId").equals(dashboardId).delete(),
        db.notices.where("dashboardId").equals(dashboardId).delete(),
        db.metrics.where("dashboardId").equals(dashboardId).delete(),
        db.metricEntries.where("dashboardId").equals(dashboardId).delete(),
        db.calendarEvents.where("dashboardId").equals(dashboardId).delete(),
        db.weatherCache.where("dashboardId").equals(dashboardId).delete(),
      ]);
      await db.dashboards.delete(dashboardId);
      await recordOutboxDelete({
        entityType: "dashboard",
        entityId: dashboardId,
        dashboardId,
        options: { skipOutbox: policy.skipOutbox },
      });
    }
  );
  if (policy.syncToServer) {
    const event = buildOutboxEvent({
      entityType: "dashboard",
      entityId: dashboardId,
      operation: "delete",
      dashboardId,
    });
    await applyEventsToServer([event]);
  }
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
}, options: WriteOptions = {}) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
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

  const createdRecords: { entityType: OutboxEntityType; record: OutboxRecord }[] = [];

  await db.transaction(
    "rw",
    [
      db.widgets,
      db.memos,
      db.todos,
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
      db.outbox,
    ],
    async () => {
      await db.widgets.add(widget);
      await recordOutboxUpsert({
        entityType: "widget",
        record: widget,
        options: { skipOutbox: policy.skipOutbox },
        now,
      });

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
        createdRecords.push({ entityType: "memo", record: memo });
        await recordOutboxUpsert({
          entityType: "memo",
          record: memo,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
        createdRecords.push({ entityType: "todo", record: todo });
        await recordOutboxUpsert({
          entityType: "todo",
          record: todo,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
      }

      if (p.type === "dday") {
        const dday: Dday = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          title: p.data.title,
          date: p.data.date,
          color: p.data.color,
          createdAt: now,
          updatedAt: now,
        };
        await db.ddays.add(dday);
        createdRecords.push({ entityType: "dday", record: dday });
        await recordOutboxUpsert({
          entityType: "dday",
          record: dday,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
        createdRecords.push({ entityType: "localPhoto", record: lp });
        await recordOutboxUpsert({
          entityType: "localPhoto",
          record: lp,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
        createdRecords.push({ entityType: "mood", record: mood });
        await recordOutboxUpsert({
          entityType: "mood",
          record: mood,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
        createdRecords.push({ entityType: "notice", record: notice });
        await recordOutboxUpsert({
          entityType: "notice",
          record: notice,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
        createdRecords.push({ entityType: "metric", record: metric });
        await recordOutboxUpsert({
          entityType: "metric",
          record: metric,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
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
          color: p.data.color,
          recurrence: p.data.recurrence,
          createdAt: now,
          updatedAt: now,
        };
        await db.calendarEvents.add(ev);
        createdRecords.push({ entityType: "calendarEvent", record: ev });
        await recordOutboxUpsert({
          entityType: "calendarEvent",
          record: ev,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
      }

      if (p.type === "weather") {
        const wc: WeatherCache = {
          id: newId(),
          widgetId,
          dashboardId: params.dashboardId,
          locationKey: p.data.locationKey,
          payload: p.data.payload,
          fetchedAt: p.data.fetchedAt ?? now,
          createdAt: now,
          updatedAt: now,
        };
        await db.weatherCache.add(wc);
        createdRecords.push({ entityType: "weatherCache", record: wc });
        await recordOutboxUpsert({
          entityType: "weatherCache",
          record: wc,
          options: { skipOutbox: policy.skipOutbox },
          now,
        });
      }
    }
  );

  if (policy.syncToServer) {
    const events: OutboxEvent[] = [];
    const widgetEvent = buildUpsertEventForRecord("widget", widget, now);
    if (widgetEvent) events.push(widgetEvent);
    for (const { entityType, record } of createdRecords) {
      if (entityType === "localPhoto") {
        const localPhoto = record as LocalPhoto;
        const storagePath = await ensureServerStoragePath(localPhoto);
        const serverPhoto = toPhotoRecord(localPhoto, storagePath);
        const photoEvent = buildUpsertEventForRecord(
          "photo",
          serverPhoto,
          now
        );
        if (photoEvent) events.push(photoEvent);
        continue;
      }
      const event = buildUpsertEventForRecord(entityType, record, now);
      if (event) events.push(event);
    }
    await applyEventsToServer(sortOutboxEvents(events));
  }

  return widgetId;
}

export async function updateWidgetLayout(
  widgetId: Id,
  layout: WidgetLayout,
  options: WriteOptions = {}
) {
  const widget = await db.widgets.get(widgetId);
  if (!widget) return;
  const policy = await resolveWritePolicy(widget.dashboardId, options);
  const now = nowIso();
  const nextWidget: Widget = { ...widget, layout, updatedAt: now };
  await db.transaction("rw", [db.widgets, db.outbox], async () => {
    await db.widgets.update(widgetId, { layout, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "widget",
      record: nextWidget,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("widget", nextWidget, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function updateWidgetSettings(
  widgetId: Id,
  settings: Record<string, unknown>,
  options: WriteOptions = {}
) {
  const widget = await db.widgets.get(widgetId);
  if (!widget) return;
  const policy = await resolveWritePolicy(widget.dashboardId, options);
  const now = nowIso();
  const nextWidget: Widget = { ...widget, settings, updatedAt: now };
  await db.transaction("rw", [db.widgets, db.outbox], async () => {
    await db.widgets.update(widgetId, { settings, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "widget",
      record: nextWidget,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("widget", nextWidget, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

/**
 * 위젯 삭제(cascade)
 * - widget 삭제 시, 해당 위젯 타입의 데이터도 같이 삭제
 * - 서버는 로그인 이후 서버 저장만 쓰므로, 로컬 삭제는 로컬 모드에서만 의미 있음
 */
export async function deleteWidgetCascade(
  widgetId: Id,
  options: WriteOptions = {}
) {
  const widget = await db.widgets.get(widgetId);
  if (!widget) return;
  const policy = await resolveWritePolicy(widget.dashboardId, options);

  await db.transaction(
    "rw",
    [
      db.widgets,
      db.memos,
      db.todos,
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
      db.outbox,
    ],
    async () => {
      await db.outbox.where("widgetId").equals(widgetId).delete();
      if (widget.type === "memo")
        await db.memos.where("widgetId").equals(widgetId).delete();
      if (widget.type === "todo")
        await db.todos.where("widgetId").equals(widgetId).delete();
      if (widget.type === "dday")
        await db.ddays.where("widgetId").equals(widgetId).delete();
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
      await recordOutboxDelete({
        entityType: "widget",
        entityId: widgetId,
        dashboardId: widget.dashboardId,
        widgetId,
        options: { skipOutbox: policy.skipOutbox },
      });
    }
  );
  if (policy.syncToServer) {
    const event = buildDeleteEventForRecord("widget", widget);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function commitWidgetLayout(
  nextWidgets: Widget[],
  options: WriteOptions = {}
) {
  if (nextWidgets.length === 0) return;
  const now = nowIso();
  const updatedWidgets = nextWidgets.map((widget) => ({
    ...widget,
    updatedAt: now,
  }));
  const policy = await resolveWritePolicy(updatedWidgets[0].dashboardId, options);
  await db.transaction("rw", [db.widgets, db.outbox], async () => {
    await db.widgets.bulkPut(updatedWidgets);
    await recordOutboxUpsertMany({
      entityType: "widget",
      records: updatedWidgets,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const events = updatedWidgets
      .map((widget) => buildUpsertEventForRecord("widget", widget, now))
      .filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(sortOutboxEvents(events));
  }
}

export async function updateMemoText(
  memo: Memo,
  text: string,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(memo.dashboardId, options);
  const now = nowIso();
  const nextMemo: Memo = { ...memo, text, updatedAt: now };
  await db.transaction("rw", [db.memos, db.outbox], async () => {
    await db.memos.update(memo.id, { text, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "memo",
      record: nextMemo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("memo", nextMemo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function addTodoItem(
  params: {
    widgetId: Id;
    dashboardId: Id;
    date: YMD;
    title: string;
    done?: boolean;
    order?: number;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const todo: Todo = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    date: params.date,
    title: params.title,
    done: params.done ?? false,
    order: params.order,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.add(todo);
    await recordOutboxUpsert({
      entityType: "todo",
      record: todo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("todo", todo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return todo.id;
}

export async function toggleTodoItem(
  todo: Todo,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(todo.dashboardId, options);
  const now = nowIso();
  const nextTodo: Todo = { ...todo, done: !todo.done, updatedAt: now };
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.update(todo.id, { done: nextTodo.done, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "todo",
      record: nextTodo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("todo", nextTodo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteTodoItem(
  todoId: Id,
  options: WriteOptions = {}
) {
  const existing = await db.todos.get(todoId);
  if (!existing) return;
  const policy = await resolveWritePolicy(existing.dashboardId, options);
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.delete(todoId);
    await recordOutboxDelete({
      entityType: "todo",
      entityId: todoId,
      dashboardId: existing.dashboardId,
      widgetId: existing.widgetId,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const event = buildDeleteEventForRecord("todo", existing);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function addDday(
  params: {
    widgetId: Id;
    dashboardId: Id;
    title: string;
    date: YMD;
    color?: string;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const dday: Dday = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    title: params.title,
    date: params.date,
    color: params.color,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.ddays, db.outbox], async () => {
    await db.ddays.add(dday);
    await recordOutboxUpsert({
      entityType: "dday",
      record: dday,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("dday", dday, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return dday.id;
}

export async function updateDday(
  dday: Dday,
  updates: Pick<Dday, "title" | "date" | "color">,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(dday.dashboardId, options);
  const now = nowIso();
  const nextDday: Dday = { ...dday, ...updates, updatedAt: now };
  await db.transaction("rw", [db.ddays, db.outbox], async () => {
    await db.ddays.update(dday.id, { ...updates, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "dday",
      record: nextDday,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("dday", nextDday, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteDdaysByIds(
  ids: Id[],
  options: WriteOptions = {}
) {
  if (!ids.length) return;
  const records = (await db.ddays.bulkGet(ids)).filter(
    (item): item is Dday => Boolean(item)
  );
  if (!records.length) return;
  const policy = await resolveWritePolicy(records[0].dashboardId, options);
  await db.transaction("rw", [db.ddays, db.outbox], async () => {
    await db.ddays.bulkDelete(ids);
    await recordOutboxDeleteMany({
      entityType: "dday",
      records,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const events = records
      .map((record) => buildDeleteEventForRecord("dday", record))
      .filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(events);
  }
}

export async function deleteDdaysByWidget(
  widgetId: Id,
  options: WriteOptions = {}
) {
  const records = await db.ddays.where("widgetId").equals(widgetId).toArray();
  if (!records.length) return;
  const policy = await resolveWritePolicy(records[0].dashboardId, options);
  await db.transaction("rw", [db.ddays, db.outbox], async () => {
    await db.ddays.where("widgetId").equals(widgetId).delete();
    await recordOutboxDeleteMany({
      entityType: "dday",
      records,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const events = records
      .map((record) => buildDeleteEventForRecord("dday", record))
      .filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(events);
  }
}

export async function addMood(
  params: {
    widgetId: Id;
    dashboardId: Id;
    date: YMD;
    mood: Mood["mood"];
    note?: string;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const mood: Mood = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    date: params.date,
    mood: params.mood,
    note: params.note,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.moods, db.outbox], async () => {
    await db.moods.add(mood);
    await recordOutboxUpsert({
      entityType: "mood",
      record: mood,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("mood", mood, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return mood.id;
}

export async function updateMood(
  mood: Mood,
  updates: Pick<Mood, "date" | "mood" | "note">,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(mood.dashboardId, options);
  const now = nowIso();
  const nextMood: Mood = { ...mood, ...updates, updatedAt: now };
  await db.transaction("rw", [db.moods, db.outbox], async () => {
    await db.moods.update(mood.id, { ...updates, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "mood",
      record: nextMood,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("mood", nextMood, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteMoodsByIds(
  ids: Id[],
  options: WriteOptions = {}
) {
  if (!ids.length) return;
  const records = (await db.moods.bulkGet(ids)).filter(
    (item): item is Mood => Boolean(item)
  );
  if (!records.length) return;
  const policy = await resolveWritePolicy(records[0].dashboardId, options);
  await db.transaction("rw", [db.moods, db.outbox], async () => {
    await db.moods.bulkDelete(ids);
    await recordOutboxDeleteMany({
      entityType: "mood",
      records,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const events = records
      .map((record) => buildDeleteEventForRecord("mood", record))
      .filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(events);
  }
}

export async function replaceLocalPhoto(
  params: {
    widgetId: Id;
    dashboardId: Id;
    file: File;
    takenAt: ISODate;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const existing = await db.localPhotos
    .where("widgetId")
    .equals(params.widgetId)
    .toArray();
  const photo: LocalPhoto = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    blob: params.file,
    mimeType: params.file.type || "application/octet-stream",
    caption: undefined,
    takenAt: params.takenAt,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.localPhotos, db.outbox], async () => {
    if (existing.length) {
      await db.localPhotos.where("widgetId").equals(params.widgetId).delete();
      await recordOutboxDeleteMany({
        entityType: "localPhoto",
        records: existing,
        options: { skipOutbox: policy.skipOutbox },
        now,
      });
    }
    await db.localPhotos.add(photo);
    await recordOutboxUpsert({
      entityType: "localPhoto",
      record: photo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const storagePath = await ensureServerStoragePath(photo);
    const serverPhoto = toPhotoRecord(photo, storagePath);
    const events = [
      ...existing
        .map((record) => buildDeleteEventForRecord("photo", record))
        .filter((event): event is OutboxEvent => Boolean(event)),
      buildUpsertEventForRecord("photo", serverPhoto, now),
    ].filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(events);
  }
}

export async function clearLocalPhotos(
  widgetId: Id,
  options: WriteOptions = {}
) {
  const records = await db.localPhotos.where("widgetId").equals(widgetId).toArray();
  if (!records.length) return;
  const policy = await resolveWritePolicy(records[0].dashboardId, options);
  await db.transaction("rw", [db.localPhotos, db.outbox], async () => {
    await db.localPhotos.where("widgetId").equals(widgetId).delete();
    await recordOutboxDeleteMany({
      entityType: "localPhoto",
      records,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const events = records
      .map((record) => buildDeleteEventForRecord("photo", record))
      .filter((event): event is OutboxEvent => Boolean(event));
    await applyEventsToServer(events);
  }
}

export async function updateMetric(
  metric: Metric,
  updates: Partial<Metric>,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(metric.dashboardId, options);
  const now = nowIso();
  const nextMetric: Metric = { ...metric, ...updates, updatedAt: now };
  await db.transaction("rw", [db.metrics, db.outbox], async () => {
    await db.metrics.update(metric.id, { ...updates, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "metric",
      record: nextMetric,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("metric", nextMetric, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function createMetric(
  params: { widgetId: Id; dashboardId: Id; name: string; unit?: string; chartType?: "line" | "bar" },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const metric: Metric = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    name: params.name,
    unit: params.unit,
    chartType: params.chartType,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.metrics, db.outbox], async () => {
    await db.metrics.add(metric);
    await recordOutboxUpsert({
      entityType: "metric",
      record: metric,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("metric", metric, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return metric.id;
}

export async function addMetricEntry(
  params: {
    widgetId: Id;
    dashboardId: Id;
    metricId: Id;
    date: YMD;
    value: number;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const entry: MetricEntry = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    metricId: params.metricId,
    date: params.date,
    value: params.value,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.metricEntries, db.outbox], async () => {
    await db.metricEntries.add(entry);
    await recordOutboxUpsert({
      entityType: "metricEntry",
      record: entry,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("metricEntry", entry, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return entry.id;
}

export async function updateMetricEntry(
  entry: MetricEntry,
  updates: Pick<MetricEntry, "date" | "value">,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(entry.dashboardId, options);
  const now = nowIso();
  const nextEntry: MetricEntry = { ...entry, ...updates, updatedAt: now };
  await db.transaction("rw", [db.metricEntries, db.outbox], async () => {
    await db.metricEntries.update(entry.id, { ...updates, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "metricEntry",
      record: nextEntry,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("metricEntry", nextEntry, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteMetricEntry(
  entryId: Id,
  options: WriteOptions = {}
) {
  const existing = await db.metricEntries.get(entryId);
  if (!existing) return;
  const policy = await resolveWritePolicy(existing.dashboardId, options);
  await db.transaction("rw", [db.metricEntries, db.outbox], async () => {
    await db.metricEntries.delete(entryId);
    await recordOutboxDelete({
      entityType: "metricEntry",
      entityId: entryId,
      dashboardId: existing.dashboardId,
      widgetId: existing.widgetId,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const event = buildDeleteEventForRecord("metricEntry", existing);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function addCalendarEvent(
  event: CalendarEvent,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(event.dashboardId, options);
  await db.transaction("rw", [db.calendarEvents, db.outbox], async () => {
    await db.calendarEvents.add(event);
    await recordOutboxUpsert({
      entityType: "calendarEvent",
      record: event,
      options: { skipOutbox: policy.skipOutbox },
      now: event.updatedAt,
    });
  });
  if (policy.syncToServer) {
    const upsertEvent = buildUpsertEventForRecord(
      "calendarEvent",
      event,
      event.updatedAt
    );
    if (upsertEvent) {
      await applyEventsToServer([upsertEvent]);
    }
  }
}

export async function updateCalendarEvent(
  eventId: Id,
  updates: Partial<CalendarEvent>,
  options: WriteOptions = {}
) {
  const existing = await db.calendarEvents.get(eventId);
  if (!existing) return;
  const policy = await resolveWritePolicy(existing.dashboardId, options);
  const now = nowIso();
  await db.transaction("rw", [db.calendarEvents, db.outbox], async () => {
    await db.calendarEvents.update(eventId, { ...updates, updatedAt: now });
    const existing = await db.calendarEvents.get(eventId);
    if (!existing) return;
    await recordOutboxUpsert({
      entityType: "calendarEvent",
      record: existing,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const updated = { ...existing, ...updates, updatedAt: now };
    const upsertEvent = buildUpsertEventForRecord("calendarEvent", updated, now);
    if (upsertEvent) {
      await applyEventsToServer([upsertEvent]);
    }
  }
}

export async function deleteCalendarEvent(
  eventId: Id,
  options: WriteOptions = {}
) {
  const existing = await db.calendarEvents.get(eventId);
  if (!existing) return;
  const policy = await resolveWritePolicy(existing.dashboardId, options);
  await db.transaction("rw", [db.calendarEvents, db.outbox], async () => {
    await db.calendarEvents.delete(eventId);
    await recordOutboxDelete({
      entityType: "calendarEvent",
      entityId: eventId,
      dashboardId: existing.dashboardId,
      widgetId: existing.widgetId,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const deleteEvent = buildDeleteEventForRecord("calendarEvent", existing);
    if (deleteEvent) {
      await applyEventsToServer([deleteEvent]);
    }
  }
}

export async function upsertWeatherCache(
  entry: WeatherCache,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(entry.dashboardId, options);
  const normalized: WeatherCache = {
    ...entry,
    createdAt: entry.createdAt ?? entry.fetchedAt,
    updatedAt: entry.updatedAt ?? entry.fetchedAt,
  };
  await db.transaction("rw", [db.weatherCache, db.outbox], async () => {
    await db.weatherCache.put(normalized);
    await recordOutboxUpsert({
      entityType: "weatherCache",
      record: normalized,
      options: { skipOutbox: policy.skipOutbox },
      now: normalized.updatedAt ?? normalized.fetchedAt,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord(
      "weatherCache",
      normalized,
      normalized.updatedAt ?? normalized.fetchedAt
    );
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function setDashboardGroupId(params: {
  dashboardId: Id;
  groupId: Id;
  updatedAt?: ISODate;
}, options: WriteOptions = {}) {
  const updatedAt = params.updatedAt ?? nowIso();
  await db.transaction("rw", [db.dashboards, db.outbox], async () => {
    const existing = await db.dashboards.get(params.dashboardId);
    if (!existing) return;
    const nextDashboard: Dashboard = {
      ...existing,
      groupId: params.groupId,
      updatedAt,
    };
    await db.dashboards.update(params.dashboardId, {
      groupId: params.groupId,
      updatedAt,
    });
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: nextDashboard,
      options,
      now: updatedAt,
    });
  });
}

export async function syncMembersFromServer(
  members: Member[],
  groupId?: Id
) {
  const groupIds = new Set<Id>();
  if (groupId) groupIds.add(groupId);
  members.forEach((member) => groupIds.add(member.groupId));
  if (groupIds.size === 0) return;
  await db.transaction("rw", db.members, async () => {
    await Promise.all(
      [...groupIds].map((id) =>
        db.members.where("groupId").equals(id).delete()
      )
    );
    if (members.length) {
      await db.members.bulkPut(members);
    }
  });
}

export async function syncDashboardsFromServer(dashboards: Dashboard[]) {
  const serverIds = new Set(dashboards.map((dashboard) => dashboard.id));
  const localDashboards = await db.dashboards.toArray();
  const missingShared = localDashboards.filter(
    (dashboard) => dashboard.groupId && !serverIds.has(dashboard.id)
  );

  if (dashboards.length) {
    await db.transaction("rw", db.dashboards, async () => {
      await db.dashboards.bulkPut(dashboards);
    });
  }

  if (missingShared.length) {
    for (const dashboard of missingShared) {
      await removeSharedDashboardLocally(dashboard.id, dashboard.groupId);
    }
  }
}

export async function removeSharedDashboardLocally(
  dashboardId: Id,
  groupId?: Id
) {
  const resolvedGroupId =
    groupId ?? (await db.dashboards.get(dashboardId))?.groupId;
  if (!resolvedGroupId) return;

  await deleteDashboardCascade(dashboardId, { skipOutbox: true });

  const remaining = await db.dashboards
    .where("groupId")
    .equals(resolvedGroupId)
    .count();
  if (remaining === 0) {
    await db.members.where("groupId").equals(resolvedGroupId).delete();
  }
}

export async function clearOutboxForDashboard(dashboardId: Id) {
  await db.outbox.where("dashboardId").equals(dashboardId).delete();
}

type DashboardSnapshot = {
  dashboard: Dashboard;
  widgets: Widget[];
  memos: Memo[];
  todos: Todo[];
  ddays: Dday[];
  photos: Photo[];
  moods: Mood[];
  notices: Notice[];
  metrics: Metric[];
  metricEntries: MetricEntry[];
  calendarEvents: CalendarEvent[];
  weatherCache: WeatherCache[];
  members?: Member[];
};

export async function exportDashboardSnapshot(dashboardId: Id) {
  const dashboard = await db.dashboards.get(dashboardId);
  if (!dashboard) return null;
  const [
    widgets,
    memos,
    todos,
    ddays,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
  ] = await Promise.all([
    db.widgets.where("dashboardId").equals(dashboardId).toArray(),
    db.memos.where("dashboardId").equals(dashboardId).toArray(),
    db.todos.where("dashboardId").equals(dashboardId).toArray(),
    db.ddays.where("dashboardId").equals(dashboardId).toArray(),
    db.moods.where("dashboardId").equals(dashboardId).toArray(),
    db.notices.where("dashboardId").equals(dashboardId).toArray(),
    db.metrics.where("dashboardId").equals(dashboardId).toArray(),
    db.metricEntries.where("dashboardId").equals(dashboardId).toArray(),
    db.calendarEvents.where("dashboardId").equals(dashboardId).toArray(),
    db.weatherCache.where("dashboardId").equals(dashboardId).toArray(),
    db.localPhotos.where("dashboardId").equals(dashboardId).toArray(),
  ]);

  const photos: Photo[] = [];
  for (const localPhoto of localPhotos) {
    if (!localPhoto.serverStoragePath && localPhoto.blob) {
      const storagePath = await ensureServerStoragePath(localPhoto);
      photos.push(toPhotoRecord(localPhoto, storagePath));
    } else if (localPhoto.serverStoragePath) {
      photos.push(toPhotoRecord(localPhoto, localPhoto.serverStoragePath));
    }
  }

  return {
    dashboard,
    widgets,
    memos,
    todos,
    ddays,
    photos,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
  } satisfies DashboardSnapshot;
}

export async function pushDashboardSnapshot(dashboardId: Id) {
  const snapshot = await exportDashboardSnapshot(dashboardId);
  if (!snapshot) return;
  const response = await fetch(`/api/dashboards/${dashboardId}/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error("Snapshot sync failed");
  }
}

export async function applyDashboardSnapshot(snapshot: DashboardSnapshot) {
  const dashboardId = snapshot.dashboard.id;
  const localPhotos: LocalPhoto[] = snapshot.photos.map((photo) => ({
    id: photo.id,
    widgetId: photo.widgetId,
    dashboardId: photo.dashboardId,
    mimeType: photo.mimeType,
    caption: photo.caption,
    takenAt: photo.takenAt,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    serverStoragePath: photo.storagePath,
  }));

  await db.transaction(
    "rw",
    [
      db.dashboards,
      db.widgets,
      db.memos,
      db.todos,
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
    ],
    async () => {
      await Promise.all([
        db.widgets.where("dashboardId").equals(dashboardId).delete(),
        db.memos.where("dashboardId").equals(dashboardId).delete(),
        db.todos.where("dashboardId").equals(dashboardId).delete(),
        db.ddays.where("dashboardId").equals(dashboardId).delete(),
        db.localPhotos.where("dashboardId").equals(dashboardId).delete(),
        db.moods.where("dashboardId").equals(dashboardId).delete(),
        db.notices.where("dashboardId").equals(dashboardId).delete(),
        db.metrics.where("dashboardId").equals(dashboardId).delete(),
        db.metricEntries.where("dashboardId").equals(dashboardId).delete(),
        db.calendarEvents.where("dashboardId").equals(dashboardId).delete(),
        db.weatherCache.where("dashboardId").equals(dashboardId).delete(),
      ]);

      await db.dashboards.put(snapshot.dashboard);
      if (snapshot.widgets.length) await db.widgets.bulkPut(snapshot.widgets);
      if (snapshot.memos.length) await db.memos.bulkPut(snapshot.memos);
      if (snapshot.todos.length) await db.todos.bulkPut(snapshot.todos);
      if (snapshot.ddays.length) await db.ddays.bulkPut(snapshot.ddays);
      if (localPhotos.length) await db.localPhotos.bulkPut(localPhotos);
      if (snapshot.moods.length) await db.moods.bulkPut(snapshot.moods);
      if (snapshot.notices.length) await db.notices.bulkPut(snapshot.notices);
      if (snapshot.metrics.length) await db.metrics.bulkPut(snapshot.metrics);
      if (snapshot.metricEntries.length)
        await db.metricEntries.bulkPut(snapshot.metricEntries);
      if (snapshot.calendarEvents.length)
        await db.calendarEvents.bulkPut(snapshot.calendarEvents);
      if (snapshot.weatherCache.length)
        await db.weatherCache.bulkPut(snapshot.weatherCache);
    }
  );

  if (snapshot.members) {
    await syncMembersFromServer(snapshot.members, snapshot.dashboard.groupId);
  }
  await clearOutboxForDashboard(dashboardId);
}

export async function flushOutbox() {
  const events = await db.outbox.toArray();
  if (!events.length) {
    return { ok: true, appliedIds: [] } satisfies ServerSyncResponse;
  }

  const toSend: OutboxEvent[] = [];
  const outboxIdByServerId = new Map<string, string>();

  for (const event of events) {
    if (event.entityType === "localPhoto") {
      if (event.operation === "delete") {
        const deleteEvent = buildOutboxEvent({
          entityType: "photo",
          entityId: event.entityId,
          operation: "delete",
          dashboardId: event.dashboardId,
          widgetId: event.widgetId,
          now: event.updatedAt,
        });
        toSend.push(deleteEvent);
        outboxIdByServerId.set(deleteEvent.id, event.id);
        continue;
      }

      const localPhoto = await db.localPhotos.get(event.entityId);
      if (!localPhoto) continue;
      if (!localPhoto.serverStoragePath && !localPhoto.blob) continue;
      const storagePath = await ensureServerStoragePath(localPhoto);
      const serverPhoto = toPhotoRecord(localPhoto, storagePath);
      const upsertEvent = buildUpsertEventForRecord(
        "photo",
        serverPhoto,
        event.updatedAt
      );
      if (!upsertEvent) continue;
      toSend.push(upsertEvent);
      outboxIdByServerId.set(upsertEvent.id, event.id);
      continue;
    }

    toSend.push(event);
    outboxIdByServerId.set(event.id, event.id);
  }

  const dashboardEventIds = new Set<Id>();
  const dashboardIds = new Set<Id>();
  for (const event of toSend) {
    if (event.entityType === "dashboard") {
      dashboardEventIds.add(event.entityId);
      dashboardIds.add(event.entityId);
    }
    if (event.dashboardId) dashboardIds.add(event.dashboardId);
  }

  for (const dashboardId of dashboardIds) {
    if (dashboardEventIds.has(dashboardId)) continue;
    const dashboard = await db.dashboards.get(dashboardId);
    if (!dashboard) continue;
    const ensureEvent = buildUpsertEventForRecord(
      "dashboard",
      dashboard,
      dashboard.updatedAt
    );
    if (ensureEvent) {
      toSend.push(ensureEvent);
      dashboardEventIds.add(dashboardId);
    }
  }

  const response = await applyEventsToServer(sortOutboxEvents(toSend));
  const applied = response.appliedIds ?? [];
  if (applied.length) {
    const outboxIds = applied
      .map((id) => outboxIdByServerId.get(id))
      .filter((id): id is string => Boolean(id));
    if (outboxIds.length) {
      await db.outbox.bulkDelete(outboxIds);
    }
  }
  return response;
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
    ddays,
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
    db.ddays.toArray(),
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
    ddays,
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
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
      db.members,
      db.outbox,
    ],
    async () => {
      await Promise.all([
        db.dashboards.clear(),
        db.widgets.clear(),
        db.memos.clear(),
        db.todos.clear(),
        db.ddays.clear(),
        db.localPhotos.clear(),
        db.moods.clear(),
        db.notices.clear(),
        db.metrics.clear(),
        db.metricEntries.clear(),
        db.calendarEvents.clear(),
        db.weatherCache.clear(),
        db.members.clear(),
        db.outbox.clear(),
      ]);
    }
  );
}

export async function deleteLocalDatabase() {
  await db.delete();
}
