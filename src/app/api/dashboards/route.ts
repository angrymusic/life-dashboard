import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { requireUser } from "@/server/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { user } = userResult.context;

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((member) => member.groupId);

  const [owned, shared] = await Promise.all([
    prisma.dashboard.findMany({ where: { ownerId: user.id } }),
    groupIds.length
      ? prisma.dashboard.findMany({ where: { groupId: { in: groupIds } } })
      : Promise.resolve([]),
  ]);

  const dashboardsMap = new Map<
    string,
    {
      id: string;
      name: string;
      ownerId: string | null;
      groupId: string | null;
      createdAt: string;
      updatedAt: string;
    }
  >();

  for (const dashboard of [...owned, ...shared]) {
    if (dashboardsMap.has(dashboard.id)) continue;
    dashboardsMap.set(dashboard.id, {
      id: dashboard.id,
      name: dashboard.name,
      ownerId: dashboard.ownerId,
      groupId: dashboard.groupId,
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
    });
  }

  const dashboards = Array.from(dashboardsMap.values());

  return NextResponse.json({ ok: true, dashboards });
}
