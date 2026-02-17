import type {
  Id,
  ISODate,
  OutboxEntityType,
  OutboxEvent,
  OutboxOperation,
} from "./schema";
import { db, nowIso } from "./core";
import { ensureServerStoragePath, toPhotoRecord } from "./photo-sync";
import { getSyncClientId } from "./sync-client";

export type WriteOptions = {
  skipOutbox?: boolean;
};

type OutboxRecord = {
  id?: unknown;
  dashboardId?: unknown;
  widgetId?: unknown;
};

function buildOutboxId(entityType: OutboxEntityType, entityId: Id) {
  return `${entityType}:${entityId}`;
}

function getRecordString(record: OutboxRecord, key: keyof OutboxRecord) {
  const value = record[key];
  return typeof value === "string" ? (value as Id) : undefined;
}

function toPayload(record: OutboxRecord) {
  return record as Record<string, unknown>;
}

function sanitizeOutboxPayload(entityType: OutboxEntityType, record: OutboxRecord) {
  const payload = toPayload(record);
  if (entityType === "localPhoto" && "blob" in payload) {
    const { blob: _blob, ...rest } = payload;
    return rest;
  }
  return payload;
}

function resolveOutboxScope(entityType: OutboxEntityType, record: OutboxRecord) {
  const dashboardId =
    getRecordString(record, "dashboardId") ??
    (entityType === "dashboard" ? getRecordString(record, "id") : undefined);
  const widgetId =
    getRecordString(record, "widgetId") ??
    (entityType === "widget" ? getRecordString(record, "id") : undefined);
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

export async function recordOutboxUpsert(params: {
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

export async function recordOutboxUpsertMany(params: {
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

export async function recordOutboxDelete(params: {
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

export async function recordOutboxDeleteMany(params: {
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

export function buildUpsertEventForRecord(
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

export function buildDeleteEventForRecord(
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

export async function resolveWritePolicy(dashboardId: Id, options?: WriteOptions) {
  const shared = await isSharedDashboard(dashboardId);
  const skipOutbox = Boolean(options?.skipOutbox || shared);
  const syncToServer = Boolean(shared && !options?.skipOutbox);
  return { shared, skipOutbox, syncToServer };
}

export function sortOutboxEvents(events: OutboxEvent[]) {
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
  dashboards?: { id: Id; updatedAt: ISODate }[];
  errors?: { id: string; error: string }[];
};

export async function applyEventsToServer(events: OutboxEvent[]) {
  if (events.length === 0) {
    return { ok: true, appliedIds: [] } satisfies ServerSyncResponse;
  }
  const syncClientId = getSyncClientId();
  const response = await fetch("/api/sync/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-client-id": syncClientId,
    },
    body: JSON.stringify({ events }),
  });
  const payload = (await response.json()) as ServerSyncResponse | null;
  if (!payload) {
    throw new Error("Server sync failed");
  }
  if (!response.ok && !payload.appliedIds) {
    throw new Error("Server sync failed");
  }
  const dashboards = payload.dashboards;
  if (dashboards?.length) {
    await db.transaction("rw", db.dashboards, async () => {
      await Promise.all(
        dashboards.map((dashboard) =>
          db.dashboards.update(dashboard.id, {
            updatedAt: dashboard.updatedAt,
          })
        )
      );
    });
  }
  return payload;
}

export async function clearOutboxForDashboard(dashboardId: Id) {
  await db.outbox.where("dashboardId").equals(dashboardId).delete();
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
