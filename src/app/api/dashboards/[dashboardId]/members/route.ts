import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import prisma from "@/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddMemberInput = {
  email: string;
  dashboardName?: string;
};

function jsonError(status: number, error: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error, ...(details ? { details } : {}) },
    { status }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAddMemberBody(body: unknown): AddMemberInput | null {
  if (!isRecord(body)) return null;
  const emailValue = body.email;
  if (typeof emailValue !== "string") return null;
  const email = emailValue.trim();
  if (!email) return null;

  let dashboardName: string | undefined;
  if (typeof body.dashboardName === "string") {
    const trimmed = body.dashboardName.trim();
    if (trimmed) dashboardName = trimmed;
  }
  if (!dashboardName && isRecord(body.dashboard)) {
    const name = body.dashboard.name;
    if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed) dashboardName = trimmed;
    }
  }

  return { email, dashboardName };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapMember(member: {
  id: string;
  groupId: string;
  role: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: member.id,
    groupId: member.groupId,
    role: member.role,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl ?? undefined,
    email: member.email,
    userId: member.userId ?? undefined,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email ?? null;
  if (!sessionEmail) {
    return jsonError(401, "Unauthorized");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = parseAddMemberBody(body);
  if (!parsed) {
    return jsonError(400, "Invalid request body", {
      hint: "Send { email, dashboardName? }",
    });
  }

  const { dashboardId } = await params;
  const requester = await prisma.user.findUnique({
    where: { email: sessionEmail },
  });
  if (!requester) {
    return jsonError(401, "Unauthorized");
  }

  let dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    if (!parsed.dashboardName) {
      return jsonError(404, "Dashboard not found", {
        hint: "Provide dashboardName to create on demand",
      });
    }
    dashboard = await prisma.dashboard.create({
      data: {
        id: dashboardId,
        name: parsed.dashboardName,
        ownerId: requester.id,
      },
    });
  }

  if (dashboard.ownerId && dashboard.ownerId !== requester.id) {
    if (!dashboard.groupId) {
      return jsonError(403, "Forbidden");
    }
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: dashboard.groupId,
        userId: requester.id,
      },
    });
    if (!member || member.role !== "parent") {
      return jsonError(403, "Forbidden");
    }
  }

  let groupId = dashboard.groupId;
  if (!groupId) {
    const group = await prisma.group.create({
      data: {},
    });
    groupId = group.id;

    dashboard = await prisma.dashboard.update({
      where: { id: dashboard.id },
      data: { groupId },
    });

    await prisma.groupMember.upsert({
      where: {
        groupId_email: {
          groupId,
          email: requester.email ?? sessionEmail,
        },
      },
      update: {
        userId: requester.id,
        role: "parent",
        displayName: requester.name ?? requester.email ?? "사용자",
        avatarUrl: requester.image,
      },
      create: {
        groupId,
        userId: requester.id,
        email: requester.email ?? sessionEmail,
        role: "parent",
        displayName: requester.name ?? requester.email ?? "사용자",
        avatarUrl: requester.image,
      },
    });
  }

  const normalizedEmail = normalizeEmail(parsed.email);
  const normalizedRequester = normalizeEmail(sessionEmail);
  if (normalizedEmail === normalizedRequester) {
    return jsonError(400, "Cannot add yourself");
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });
  if (!targetUser || !targetUser.email) {
    return jsonError(404, "User not found", { email: parsed.email });
  }

  await prisma.groupMember.upsert({
    where: {
      groupId_email: {
        groupId,
        email: targetUser.email,
      },
    },
    update: {
      userId: targetUser.id,
      role: "child",
      displayName: targetUser.name ?? targetUser.email,
      avatarUrl: targetUser.image,
    },
    create: {
      groupId,
      userId: targetUser.id,
      email: targetUser.email,
      role: "child",
      displayName: targetUser.name ?? targetUser.email,
      avatarUrl: targetUser.image,
    },
  });

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    dashboard: {
      id: dashboard.id,
      groupId,
      updatedAt: dashboard.updatedAt.toISOString(),
    },
    members: members.map(mapMember),
  });
}
