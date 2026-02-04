import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import prisma from "@/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!email) return jsonError(401, "Unauthorized");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return jsonError(401, "Unauthorized");

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

  const dashboards = [...owned, ...shared].reduce<
    Array<{
      id: string;
      name: string;
      ownerId: string | null;
      groupId: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >((acc, dashboard) => {
    if (acc.some((item) => item.id === dashboard.id)) return acc;
    acc.push({
      id: dashboard.id,
      name: dashboard.name,
      ownerId: dashboard.ownerId,
      groupId: dashboard.groupId,
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
    });
    return acc;
  }, []);

  return NextResponse.json({ ok: true, dashboards });
}
