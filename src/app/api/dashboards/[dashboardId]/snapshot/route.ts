import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError, parseJson } from "@/server/api-response";
import { isAdminRole, requireUser } from "@/server/api-auth";
import { isSafeIdentifier, parsePositiveIntEnv } from "@/server/request-guards";
import { removePhotoFilesIfUnreferenced } from "@/server/photo-file-cleanup";
import {
  persistSnapshot,
  serializeSnapshot,
  validateSnapshotPayload,
} from "./snapshot-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
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
  } else if (!dashboard.ownerId || dashboard.ownerId !== userId) {
    return null;
  }
  return dashboard;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }
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
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const parsedBody = await parseJson(request, {
    maxBytes: parsePositiveIntEnv(
      process.env.DASHBOARD_SNAPSHOT_MAX_BYTES,
      2 * 1024 * 1024
    ),
  });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }
  const validation = validateSnapshotPayload(body, dashboardId);
  if (!validation.ok) {
    return jsonError(validation.status, validation.error);
  }
  const snapshot = validation.snapshot;

  const existing = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true },
  });
  let resolvedGroupId: string | null = existing?.groupId ?? null;

  if (existing) {
    if (existing.groupId) {
      const member = await prisma.groupMember.findFirst({
        where: { groupId: existing.groupId, userId },
        select: { id: true, role: true },
      });
      if (!member || !isAdminRole(member.role)) {
        return jsonError(403, "Forbidden");
      }
    } else if (!existing.ownerId || existing.ownerId !== userId) {
      return jsonError(403, "Forbidden");
    }
  } else if (snapshot.dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: snapshot.dashboard.groupId, userId },
      select: { id: true, role: true },
    });
    if (!member || !isAdminRole(member.role)) {
      return jsonError(403, "Forbidden");
    }
    resolvedGroupId = snapshot.dashboard.groupId;
  }

  const serialized = serializeSnapshot(snapshot, dashboardId);
  const photosToCleanup = await prisma.photo.findMany({
    where: { dashboardId },
    select: { dashboardId: true, storagePath: true },
  });

  await prisma.$transaction(async (tx) => {
    await persistSnapshot(tx, serialized, {
      userId,
      existing,
      resolvedGroupId,
    });
  });
  await removePhotoFilesIfUnreferenced(photosToCleanup);

  return NextResponse.json({ ok: true });
}
