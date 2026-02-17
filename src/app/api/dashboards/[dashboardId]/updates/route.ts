import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import { getLatestDashboardUpdate } from "@/server/dashboard-updates";
import { isSafeIdentifier } from "@/server/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAccess(dashboardId: string, userId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true, updatedAt: true },
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
  const updatedAt = dashboard.updatedAt.toISOString();
  const latest = getLatestDashboardUpdate(dashboardId);
  const clientId = latest && latest.updatedAt === updatedAt ? latest.clientId : undefined;

  return NextResponse.json({
    ok: true,
    updatedAt,
    ...(clientId ? { clientId } : {}),
  });
}
