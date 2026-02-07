import type { Id, Metric, MetricEntry, YMD } from "../schema";
import { db, newId, nowIso } from "../core";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDelete,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

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
  params: {
    widgetId: Id;
    dashboardId: Id;
    name: string;
    unit?: string;
    chartType?: "line" | "bar";
  },
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

export async function deleteMetricEntry(entryId: Id, options: WriteOptions = {}) {
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
