import type {
  CalendarEvent,
  Dday,
  Id,
  LocalPhoto,
  Memo,
  Mood,
  Metric,
  Notice,
  OutboxEntityType,
  OutboxEvent,
  Todo,
  WeatherCache,
  Widget,
  WidgetLayout,
  WidgetType,
  YMD,
} from "../schema";
import { db, newId, nowIso } from "../core";
import { ensureServerStoragePath, toPhotoRecord } from "../photo-sync";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDelete,
  recordOutboxUpsert,
  recordOutboxUpsertMany,
  resolveWritePolicy,
  sortOutboxEvents,
  type WriteOptions,
} from "../outbox";

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

export async function addWidget(
  params: {
    dashboardId: Id;
    type: WidgetType;
    layout: WidgetLayout;
    settings?: Record<string, unknown>;
    createdBy?: Id;
    payload?: CreateWidgetPayload;
  },
  options: WriteOptions = {}
) {
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

  const createdRecords: { entityType: OutboxEntityType; record: Record<string, unknown> }[] = [];

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
        const photoEvent = buildUpsertEventForRecord("photo", serverPhoto, now);
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

export async function deleteWidgetCascade(widgetId: Id, options: WriteOptions = {}) {
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
        const metrics = await db.metrics.where("widgetId").equals(widgetId).toArray();
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

export async function commitWidgetLayout(nextWidgets: Widget[], options: WriteOptions = {}) {
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
