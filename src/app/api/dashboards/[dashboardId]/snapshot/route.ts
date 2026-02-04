import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import prisma from "@/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error, ...(details ? { details } : {}) },
    { status }
  );
}

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

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

async function getUserIdFromSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  return user?.id ?? null;
}

async function ensureAccess(dashboardId: string, userId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      id: true,
      ownerId: true,
      groupId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!dashboard) return null;
  if (dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: dashboard.groupId, userId },
      select: { id: true },
    });
    if (!member) return null;
  } else if (dashboard.ownerId && dashboard.ownerId !== userId) {
    return null;
  }
  return dashboard;
}

type SnapshotPayload = {
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userId = await getUserIdFromSession();
  if (!userId) return jsonError(401, "Unauthorized");

  const { dashboardId } = await params;
  const dashboard = await ensureAccess(dashboardId, userId);
  if (!dashboard) return jsonError(404, "Dashboard not found");

  const [
    widgets,
    memos,
    todos,
    ddays,
    photos,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    members,
  ] = await Promise.all([
    prisma.widget.findMany({ where: { dashboardId } }),
    prisma.memo.findMany({ where: { dashboardId } }),
    prisma.todo.findMany({ where: { dashboardId } }),
    prisma.dday.findMany({ where: { dashboardId } }),
    prisma.photo.findMany({ where: { dashboardId } }),
    prisma.mood.findMany({ where: { dashboardId } }),
    prisma.notice.findMany({ where: { dashboardId } }),
    prisma.metric.findMany({ where: { dashboardId } }),
    prisma.metricEntry.findMany({ where: { dashboardId } }),
    prisma.calendarEvent.findMany({ where: { dashboardId } }),
    prisma.weatherCache.findMany({ where: { dashboardId } }),
    dashboard.groupId
      ? prisma.groupMember.findMany({ where: { groupId: dashboard.groupId } })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ok: true,
    dashboard: {
      id: dashboard.id,
      name: dashboard.name,
      ownerId: dashboard.ownerId ?? undefined,
      groupId: dashboard.groupId ?? undefined,
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
    },
    widgets: widgets.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    memos: memos.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    todos: todos.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    ddays: ddays.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    photos: photos.map((item) => ({
      ...item,
      takenAt: toIso(item.takenAt),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    moods: moods.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    notices: notices.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    metrics: metrics.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    metricEntries: metricEntries.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    calendarEvents: calendarEvents.map((item) => ({
      ...item,
      startAt: item.startAt.toISOString(),
      endAt: toIso(item.endAt),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    weatherCache: weatherCache.map((item) => ({
      ...item,
      fetchedAt: item.fetchedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    members: members.map((item) => ({
      ...item,
      avatarUrl: item.avatarUrl ?? undefined,
      userId: item.userId ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userId = await getUserIdFromSession();
  if (!userId) return jsonError(401, "Unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  if (!isRecord(body) || !isRecord(body.dashboard)) {
    return jsonError(400, "Invalid snapshot payload");
  }

  const snapshot = body as SnapshotPayload;
  const { dashboardId } = await params;
  if (snapshot.dashboard.id && snapshot.dashboard.id !== dashboardId) {
    return jsonError(400, "Dashboard ID mismatch");
  }

  const existing = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true },
  });

  if (existing) {
    if (existing.groupId) {
      const member = await prisma.groupMember.findFirst({
        where: { groupId: existing.groupId, userId },
        select: { id: true },
      });
      if (!member) return jsonError(403, "Forbidden");
    } else if (existing.ownerId && existing.ownerId !== userId) {
      return jsonError(403, "Forbidden");
    }
  }

  const dashboardName = snapshot.dashboard.name?.trim() || "Dashboard";
  const groupId = existing?.groupId ?? snapshot.dashboard.groupId ?? null;

  const widgets = snapshot.widgets ?? [];
  const memos = snapshot.memos ?? [];
  const todos = snapshot.todos ?? [];
  const ddays = snapshot.ddays ?? [];
  const photos = snapshot.photos ?? [];
  const moods = snapshot.moods ?? [];
  const notices = snapshot.notices ?? [];
  const metrics = snapshot.metrics ?? [];
  const metricEntries = snapshot.metricEntries ?? [];
  const calendarEvents = snapshot.calendarEvents ?? [];
  const weatherCache = snapshot.weatherCache ?? [];

  await prisma.$transaction(async (tx) => {
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
        name: dashboardName,
        ownerId: existing?.ownerId ?? userId,
        groupId: groupId ?? undefined,
      },
      create: {
        id: dashboardId,
        name: dashboardName,
        ownerId: userId,
        groupId: groupId ?? undefined,
      },
    });

    if (widgets.length) {
      await tx.widget.createMany({
        data: widgets.map((item) => ({
          id: String(item.id),
          dashboardId,
          type: String(item.type),
          layout: item.layout ?? {},
          settings: item.settings ?? undefined,
          createdBy: item.createdBy ? String(item.createdBy) : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (memos.length) {
      await tx.memo.createMany({
        data: memos.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          text: String(item.text ?? ""),
          color: item.color ? String(item.color) : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (todos.length) {
      await tx.todo.createMany({
        data: todos.map((item) => ({
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
      });
    }

    if (ddays.length) {
      await tx.dday.createMany({
        data: ddays.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          title: String(item.title ?? ""),
          date: String(item.date ?? ""),
          color: item.color ? String(item.color) : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (photos.length) {
      await tx.photo.createMany({
        data: photos.map((item) => ({
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
      });
    }

    if (moods.length) {
      await tx.mood.createMany({
        data: moods.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          date: String(item.date ?? ""),
          mood: String(item.mood ?? ""),
          note: item.note ? String(item.note) : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (notices.length) {
      await tx.notice.createMany({
        data: notices.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          title: String(item.title ?? ""),
          body: String(item.body ?? ""),
          pinned: typeof item.pinned === "boolean" ? item.pinned : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (metrics.length) {
      await tx.metric.createMany({
        data: metrics.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          name: String(item.name ?? ""),
          unit: item.unit ? String(item.unit) : undefined,
          chartType: item.chartType ? String(item.chartType) : undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (metricEntries.length) {
      await tx.metricEntry.createMany({
        data: metricEntries.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          metricId: String(item.metricId ?? ""),
          date: String(item.date ?? ""),
          value: Number(item.value ?? 0),
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (calendarEvents.length) {
      await tx.calendarEvent.createMany({
        data: calendarEvents.map((item) => ({
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
          recurrence: item.recurrence ?? undefined,
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }

    if (weatherCache.length) {
      await tx.weatherCache.createMany({
        data: weatherCache.map((item) => ({
          id: String(item.id),
          widgetId: String(item.widgetId),
          dashboardId,
          locationKey: String(item.locationKey ?? ""),
          payload: item.payload ?? {},
          fetchedAt: parseDate(item.fetchedAt),
          createdAt: parseDate(item.createdAt),
          updatedAt: parseDate(item.updatedAt),
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
