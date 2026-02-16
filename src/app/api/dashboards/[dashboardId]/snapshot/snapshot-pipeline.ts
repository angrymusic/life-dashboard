import type { Prisma } from "@prisma/client";

export type SnapshotPayload = {
  dashboard: {
    id: string;
    name: string;
    ownerId?: string;
    groupId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  widgets?: Record<string, unknown>[];
  memos?: Record<string, unknown>[];
  todos?: Record<string, unknown>[];
  ddays?: Record<string, unknown>[];
  photos?: Record<string, unknown>[];
  moods?: Record<string, unknown>[];
  notices?: Record<string, unknown>[];
  metrics?: Record<string, unknown>[];
  metricEntries?: Record<string, unknown>[];
  calendarEvents?: Record<string, unknown>[];
  weatherCache?: Record<string, unknown>[];
};

type SnapshotValidationResult =
  | { ok: true; snapshot: SnapshotPayload }
  | { ok: false; status: number; error: string };

export type SerializedSnapshot = {
  dashboardId: string;
  dashboardName: string;
  groupId: string | null;
  widgets: Prisma.WidgetCreateManyInput[];
  memos: Prisma.MemoCreateManyInput[];
  todos: Prisma.TodoCreateManyInput[];
  ddays: Prisma.DdayCreateManyInput[];
  photos: Prisma.PhotoCreateManyInput[];
  moods: Prisma.MoodCreateManyInput[];
  notices: Prisma.NoticeCreateManyInput[];
  metrics: Prisma.MetricCreateManyInput[];
  metricEntries: Prisma.MetricEntryCreateManyInput[];
  calendarEvents: Prisma.CalendarEventCreateManyInput[];
  weatherCache: Prisma.WeatherCacheCreateManyInput[];
};

const recordArrayKeys = [
  "widgets",
  "memos",
  "todos",
  "ddays",
  "photos",
  "moods",
  "notices",
  "metrics",
  "metricEntries",
  "calendarEvents",
  "weatherCache",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return parseDate(value as string);
}

function toInputJson(value: unknown, fallback: Prisma.InputJsonValue) {
  return (value ?? fallback) as Prisma.InputJsonValue;
}

function toOptionalInputJson(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export function validateSnapshotPayload(
  body: unknown,
  dashboardId: string
): SnapshotValidationResult {
  if (!isRecord(body) || !isRecord(body.dashboard)) {
    return { ok: false, status: 400, error: "Invalid snapshot payload" };
  }

  const snapshot = body as SnapshotPayload;
  if (snapshot.dashboard.id && snapshot.dashboard.id !== dashboardId) {
    return { ok: false, status: 400, error: "Dashboard ID mismatch" };
  }

  for (const key of recordArrayKeys) {
    const value = snapshot[key];
    if (value === null || value === undefined) continue;
    if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
      return { ok: false, status: 400, error: "Invalid snapshot payload" };
    }
  }

  return { ok: true, snapshot };
}

export function serializeSnapshot(
  snapshot: SnapshotPayload,
  dashboardId: string
): SerializedSnapshot {
  const dashboardName =
    typeof snapshot.dashboard.name === "string"
      ? snapshot.dashboard.name.trim() || "Dashboard"
      : "Dashboard";
  const groupId = snapshot.dashboard.groupId ?? null;

  const widgets = (snapshot.widgets ?? []) as Record<string, unknown>[];
  const memos = (snapshot.memos ?? []) as Record<string, unknown>[];
  const todos = (snapshot.todos ?? []) as Record<string, unknown>[];
  const ddays = (snapshot.ddays ?? []) as Record<string, unknown>[];
  const photos = (snapshot.photos ?? []) as Record<string, unknown>[];
  const moods = (snapshot.moods ?? []) as Record<string, unknown>[];
  const notices = (snapshot.notices ?? []) as Record<string, unknown>[];
  const metrics = (snapshot.metrics ?? []) as Record<string, unknown>[];
  const metricEntries = (snapshot.metricEntries ?? []) as Record<string, unknown>[];
  const calendarEvents = (snapshot.calendarEvents ?? []) as Record<string, unknown>[];
  const weatherCache = (snapshot.weatherCache ?? []) as Record<string, unknown>[];

  return {
    dashboardId,
    dashboardName,
    groupId,
    widgets: widgets.map((item) => ({
      id: String(item.id),
      dashboardId,
      type: String(item.type),
      layout: toInputJson(item.layout, {}),
      settings: toOptionalInputJson(item.settings),
      createdBy: item.createdBy ? String(item.createdBy) : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    memos: memos.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      text: String(item.text ?? ""),
      color: item.color ? String(item.color) : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    todos: todos.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      date: String(item.date ?? ""),
      title: String(item.title ?? ""),
      done: Boolean(item.done),
      order: typeof item.order === "number" ? item.order : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    ddays: ddays.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      title: String(item.title ?? ""),
      date: String(item.date ?? ""),
      color: item.color ? String(item.color) : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    photos: photos.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      storagePath: String(item.storagePath ?? ""),
      mimeType: String(item.mimeType ?? ""),
      caption: item.caption ? String(item.caption) : undefined,
      takenAt: parseOptionalDate(item.takenAt),
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    moods: moods.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      date: String(item.date ?? ""),
      mood: String(item.mood ?? ""),
      note: item.note ? String(item.note) : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    notices: notices.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      title: String(item.title ?? ""),
      body: String(item.body ?? ""),
      pinned: typeof item.pinned === "boolean" ? item.pinned : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    metrics: metrics.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      name: String(item.name ?? ""),
      unit: item.unit ? String(item.unit) : undefined,
      chartType: item.chartType ? String(item.chartType) : undefined,
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    metricEntries: metricEntries.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      metricId: String(item.metricId ?? ""),
      date: String(item.date ?? ""),
      value: Number(item.value ?? 0),
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    calendarEvents: calendarEvents.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      title: String(item.title ?? ""),
      startAt: parseDate(item.startAt),
      endAt: parseOptionalDate(item.endAt),
      allDay: typeof item.allDay === "boolean" ? item.allDay : undefined,
      location: item.location ? String(item.location) : undefined,
      description: item.description ? String(item.description) : undefined,
      color: item.color ? String(item.color) : undefined,
      recurrence: toOptionalInputJson(item.recurrence),
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
    weatherCache: weatherCache.map((item) => ({
      id: String(item.id),
      widgetId: String(item.widgetId),
      dashboardId,
      locationKey: String(item.locationKey ?? ""),
      payload: toInputJson(item.payload, {}),
      fetchedAt: parseDate(item.fetchedAt),
      createdAt: parseDate(item.createdAt),
      updatedAt: parseDate(item.updatedAt),
    })),
  };
}

export async function persistSnapshot(
  tx: Prisma.TransactionClient,
  serialized: SerializedSnapshot,
  context: {
    userId: string;
    existing: { ownerId: string | null; groupId: string | null } | null;
    resolvedGroupId: string | null;
  }
) {
  const dashboardId = serialized.dashboardId;
  const groupId = context.resolvedGroupId;

  await tx.metricEntry.deleteMany({ where: { dashboardId } });
  await tx.metric.deleteMany({ where: { dashboardId } });
  await tx.memo.deleteMany({ where: { dashboardId } });
  await tx.todo.deleteMany({ where: { dashboardId } });
  await tx.dday.deleteMany({ where: { dashboardId } });
  await tx.photo.deleteMany({ where: { dashboardId } });
  await tx.mood.deleteMany({ where: { dashboardId } });
  await tx.notice.deleteMany({ where: { dashboardId } });
  await tx.calendarEvent.deleteMany({ where: { dashboardId } });
  await tx.weatherCache.deleteMany({ where: { dashboardId } });
  await tx.widget.deleteMany({ where: { dashboardId } });

  await tx.dashboard.upsert({
    where: { id: dashboardId },
    update: {
      name: serialized.dashboardName,
      ownerId: context.existing?.ownerId ?? context.userId,
      groupId: groupId ?? undefined,
    },
    create: {
      id: dashboardId,
      name: serialized.dashboardName,
      ownerId: context.userId,
      groupId: groupId ?? undefined,
    },
  });

  if (serialized.widgets.length) {
    await tx.widget.createMany({
      data: serialized.widgets,
    });
  }

  if (serialized.memos.length) {
    await tx.memo.createMany({
      data: serialized.memos,
    });
  }

  if (serialized.todos.length) {
    await tx.todo.createMany({
      data: serialized.todos,
    });
  }

  if (serialized.ddays.length) {
    await tx.dday.createMany({
      data: serialized.ddays,
    });
  }

  if (serialized.photos.length) {
    await tx.photo.createMany({
      data: serialized.photos,
    });
  }

  if (serialized.moods.length) {
    await tx.mood.createMany({
      data: serialized.moods,
    });
  }

  if (serialized.notices.length) {
    await tx.notice.createMany({
      data: serialized.notices,
    });
  }

  if (serialized.metrics.length) {
    await tx.metric.createMany({
      data: serialized.metrics,
    });
  }

  if (serialized.metricEntries.length) {
    await tx.metricEntry.createMany({
      data: serialized.metricEntries,
    });
  }

  if (serialized.calendarEvents.length) {
    await tx.calendarEvent.createMany({
      data: serialized.calendarEvents,
    });
  }

  if (serialized.weatherCache.length) {
    await tx.weatherCache.createMany({
      data: serialized.weatherCache,
    });
  }
}
