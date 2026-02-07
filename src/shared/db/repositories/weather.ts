import type { WeatherCache } from "../schema";
import { db } from "../core";
import {
  applyEventsToServer,
  buildUpsertEventForRecord,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

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
