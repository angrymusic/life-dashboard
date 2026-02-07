import type { Id, Mood, OutboxEvent, YMD } from "../schema";
import { db, newId, nowIso } from "../core";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDeleteMany,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

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

export async function deleteMoodsByIds(ids: Id[], options: WriteOptions = {}) {
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
