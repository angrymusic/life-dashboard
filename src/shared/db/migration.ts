import type { MigrationState } from "./schema";
import { db, getOrCreateLocalProfileId, nowIso } from "./core";

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
