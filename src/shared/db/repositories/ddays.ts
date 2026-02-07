import type { Dday, Id, OutboxEvent, YMD } from "../schema";
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

export async function deleteDdaysByIds(ids: Id[], options: WriteOptions = {}) {
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

export async function deleteDdaysByWidget(widgetId: Id, options: WriteOptions = {}) {
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
