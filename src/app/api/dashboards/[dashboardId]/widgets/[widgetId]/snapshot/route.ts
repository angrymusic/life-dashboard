import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import { isSafeIdentifier } from "@/server/request-guards";

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
  { params }: { params: Promise<{ dashboardId: string; widgetId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const { dashboardId, widgetId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }
  if (!isSafeIdentifier(widgetId)) {
    return jsonError(400, "Invalid widget ID");
  }

  const dashboard = await ensureAccess(dashboardId, userId);
  if (!dashboard) return jsonError(404, "Dashboard not found");

  const widget = await prisma.widget.findUnique({
    where: { id: widgetId },
  });
  if (!widget || widget.dashboardId !== dashboardId) {
    return jsonError(404, "Widget not found");
  }

  const [
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
  ] = await Promise.all([
    prisma.memo.findMany({ where: { dashboardId, widgetId } }),
    prisma.todo.findMany({ where: { dashboardId, widgetId } }),
    prisma.dday.findMany({ where: { dashboardId, widgetId } }),
    prisma.photo.findMany({ where: { dashboardId, widgetId } }),
    prisma.mood.findMany({ where: { dashboardId, widgetId } }),
    prisma.notice.findMany({ where: { dashboardId, widgetId } }),
    prisma.metric.findMany({ where: { dashboardId, widgetId } }),
    prisma.metricEntry.findMany({ where: { dashboardId, widgetId } }),
    prisma.calendarEvent.findMany({ where: { dashboardId, widgetId } }),
    prisma.weatherCache.findMany({ where: { dashboardId, widgetId } }),
  ]);

  return NextResponse.json({
    ok: true,
    widget: {
      ...widget,
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString(),
    },
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
  });
}
