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
    select: { id: true, ownerId: true, groupId: true, updatedAt: true },
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userId = await getUserIdFromSession();
  if (!userId) return jsonError(401, "Unauthorized");

  const { dashboardId } = await params;
  const dashboard = await ensureAccess(dashboardId, userId);
  if (!dashboard) return jsonError(404, "Dashboard not found");

  return NextResponse.json({
    ok: true,
    updatedAt: dashboard.updatedAt.toISOString(),
  });
}
