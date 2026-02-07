import type { CalendarEvent, Id } from "../schema";
import { db, nowIso } from "../core";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDelete,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

export async function addCalendarEvent(event: CalendarEvent, options: WriteOptions = {}) {
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
    const refreshed = await db.calendarEvents.get(eventId);
    if (!refreshed) return;
    await recordOutboxUpsert({
      entityType: "calendarEvent",
      record: refreshed,
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

export async function deleteCalendarEvent(eventId: Id, options: WriteOptions = {}) {
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
