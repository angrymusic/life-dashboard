import type { Id, ISODate, LocalPhoto, OutboxEvent } from "../schema";
import { db, newId, nowIso } from "../core";
import { ensureServerStoragePath, toPhotoRecord } from "../photo-sync";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDeleteMany,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

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

export async function clearLocalPhotos(widgetId: Id, options: WriteOptions = {}) {
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
