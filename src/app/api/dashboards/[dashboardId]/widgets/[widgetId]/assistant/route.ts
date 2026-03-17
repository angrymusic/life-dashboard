import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import { getOrCreateWeeklySummary, validateSummaryWindow } from "@/server/dashboard-assistant";
import { isSafeIdentifier } from "@/server/request-guards";
import { detectLanguageFromRequest } from "@/shared/i18n/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAccess(
  dashboardId: string,
  widgetId: string,
  userId: string,
  allowedTypes: string[]
) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true },
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

  const widget = await prisma.widget.findUnique({
    where: { id: widgetId },
    select: { id: true, dashboardId: true, type: true },
  });
  if (
    !widget ||
    widget.dashboardId !== dashboardId ||
    !allowedTypes.includes(widget.type)
  ) {
    return null;
  }

  return { dashboard, widget };
}

function parseWindowParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowStartYmd = searchParams.get("windowStartYmd")?.trim() ?? "";
  const windowEndYmd = searchParams.get("windowEndYmd")?.trim() ?? "";
  const windowStartAt = searchParams.get("windowStartAt")?.trim() ?? "";
  const windowEndAt = searchParams.get("windowEndAt")?.trim() ?? "";
  return validateSummaryWindow({
    windowStartYmd,
    windowEndYmd,
    windowStartAt,
    windowEndAt,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string; widgetId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { dashboardId, widgetId } = await params;
  if (!isSafeIdentifier(dashboardId)) return jsonError(400, "Invalid dashboard ID");
  if (!isSafeIdentifier(widgetId)) return jsonError(400, "Invalid widget ID");

  const access = await ensureAccess(
    dashboardId,
    widgetId,
    userResult.context.userId,
    ["weeklySummary"]
  );
  if (!access) return jsonError(404, "Widget not found");

  const window = parseWindowParams(request);
  if (!window) {
    return jsonError(400, "Invalid summary window");
  }
  const language = detectLanguageFromRequest(request);

  const summary = await getOrCreateWeeklySummary({
    widgetId,
    dashboardId,
    windowStartYmd: window.windowStartYmd,
    windowEndYmd: window.windowEndYmd,
    windowStartAt: window.windowStartAt,
    windowEndAt: window.windowEndAt,
    startAt: window.startAt,
    endAt: window.endAt,
    language,
  });

  return NextResponse.json({ ok: true, summary });
}
