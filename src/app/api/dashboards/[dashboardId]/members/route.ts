import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError, parseJson } from "@/server/api-response";
import { isAdminRole, requireUser } from "@/server/api-auth";
import { detectLanguageFromRequest } from "@/shared/i18n/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddMemberInput = {
  email: string;
  dashboardName?: string;
  role: "parent" | "child";
};

type UpdateMemberRoleInput = {
  memberId: string;
  role: "parent" | "child";
};

type RemoveMemberInput = {
  memberId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const memberRoles = new Set(["child", "member", "user"]);

function normalizeRoleInput(value: unknown): "parent" | "child" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (isAdminRole(normalized)) return "parent";
  if (memberRoles.has(normalized)) return "child";
  return null;
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

  let role: "parent" | "child" = "child";
  if ("role" in body) {
    const normalizedRole = normalizeRoleInput(body.role);
    if (!normalizedRole) return null;
    role = normalizedRole;
  }

  return { email, dashboardName, role };
}

function parseUpdateMemberRoleBody(body: unknown): UpdateMemberRoleInput | null {
  if (!isRecord(body)) return null;
  const memberIdValue = body.memberId;
  if (typeof memberIdValue !== "string") return null;
  const memberId = memberIdValue.trim();
  if (!memberId) return null;

  const normalizedRole = normalizeRoleInput(body.role);
  if (!normalizedRole) return null;

  return { memberId, role: normalizedRole };
}

function parseRemoveMemberBody(body: unknown): RemoveMemberInput | null {
  if (!isRecord(body)) return null;
  const memberIdValue = body.memberId;
  if (typeof memberIdValue !== "string") return null;
  const memberId = memberIdValue.trim();
  if (!memberId) return null;
  return { memberId };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function tr(language: "ko" | "en", ko: string, en: string) {
  return language === "ko" ? ko : en;
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
  const language = detectLanguageFromRequest(request);
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { user: requester, email: sessionEmail } = userResult.context;

  const parsedBody = await parseJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const parsed = parseAddMemberBody(body);
  if (!parsed) {
    return jsonError(400, tr(language, "요청 본문 형식이 올바르지 않아요.", "Invalid request body"), {
      hint: tr(
        language,
        "다음 형식으로 보내주세요: { email, dashboardName? }",
        "Send { email, dashboardName? }"
      ),
    });
  }

  const { dashboardId } = await params;
  let dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });

  if (!dashboard) {
    if (!parsed.dashboardName) {
      return jsonError(404, tr(language, "대시보드를 찾을 수 없어요.", "Dashboard not found"), {
        hint: tr(
          language,
          "없으면 dashboardName을 함께 보내 생성해주세요.",
          "Provide dashboardName to create on demand"
        ),
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

  if (dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: dashboard.groupId,
        userId: requester.id,
      },
    });
    if (!member || !isAdminRole(member.role)) {
      return jsonError(403, tr(language, "권한이 없어요.", "Forbidden"));
    }
  } else if (!dashboard.ownerId || dashboard.ownerId !== requester.id) {
    return jsonError(403, tr(language, "권한이 없어요.", "Forbidden"));
  }

  const normalizedEmail = normalizeEmail(parsed.email);
  const normalizedRequester = normalizeEmail(sessionEmail);
  if (normalizedEmail === normalizedRequester) {
    return jsonError(
      400,
      tr(
        language,
        "본인은 구성원으로 추가할 수 없어요.",
        "Cannot add yourself"
      )
    );
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
    return jsonError(
      404,
      tr(language, "사용자를 찾을 수 없어요.", "User not found"),
      { email: parsed.email }
    );
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
        displayName:
          requester.name ??
          requester.email ??
          tr(language, "사용자", "User"),
        avatarUrl: requester.image,
      },
      create: {
        groupId,
        userId: requester.id,
        email: requester.email ?? sessionEmail,
        role: "parent",
        displayName:
          requester.name ??
          requester.email ??
          tr(language, "사용자", "User"),
        avatarUrl: requester.image,
      },
    });
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
      role: parsed.role,
      displayName: targetUser.name ?? targetUser.email,
      avatarUrl: targetUser.image,
    },
    create: {
      groupId,
      userId: targetUser.id,
      email: targetUser.email,
      role: parsed.role,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const language = detectLanguageFromRequest(request);
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { user: requester } = userResult.context;

  const parsedBody = await parseJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const parsed = parseUpdateMemberRoleBody(body);
  if (!parsed) {
    return jsonError(400, tr(language, "요청 본문 형식이 올바르지 않아요.", "Invalid request body"), {
      hint: tr(
        language,
        "다음 형식으로 보내주세요: { memberId, role }",
        "Send { memberId, role }"
      ),
    });
  }

  const { dashboardId } = await params;
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });
  if (!dashboard) {
    return jsonError(404, tr(language, "대시보드를 찾을 수 없어요.", "Dashboard not found"));
  }
  if (!dashboard.groupId) {
    return jsonError(
      400,
      tr(language, "공유 대시보드가 아니에요.", "Dashboard is not shared")
    );
  }

  const requesterMember = await prisma.groupMember.findFirst({
    where: {
      groupId: dashboard.groupId,
      userId: requester.id,
    },
  });
  if (!requesterMember || !isAdminRole(requesterMember.role)) {
    return jsonError(403, tr(language, "권한이 없어요.", "Forbidden"));
  }

  const targetMember = await prisma.groupMember.findFirst({
    where: {
      id: parsed.memberId,
      groupId: dashboard.groupId,
    },
  });
  if (!targetMember) {
    return jsonError(404, tr(language, "구성원을 찾을 수 없어요.", "Member not found"));
  }

  const firstMember = await prisma.groupMember.findFirst({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firstMember?.id === targetMember.id && parsed.role !== "parent") {
    return jsonError(
      400,
      tr(
        language,
        "첫 생성자의 권한은 변경할 수 없어요.",
        "You cannot change the first creator's role."
      )
    );
  }

  await prisma.groupMember.update({
    where: { id: targetMember.id },
    data: { role: parsed.role },
  });

  const members = await prisma.groupMember.findMany({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    members: members.map(mapMember),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const language = detectLanguageFromRequest(request);
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { user: requester } = userResult.context;

  const parsedBody = await parseJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const parsed = parseRemoveMemberBody(body);
  if (!parsed) {
    return jsonError(400, tr(language, "요청 본문 형식이 올바르지 않아요.", "Invalid request body"), {
      hint: tr(
        language,
        "다음 형식으로 보내주세요: { memberId }",
        "Send { memberId }"
      ),
    });
  }

  const { dashboardId } = await params;

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  });
  if (!dashboard) {
    return jsonError(404, tr(language, "대시보드를 찾을 수 없어요.", "Dashboard not found"));
  }
  if (!dashboard.groupId) {
    return jsonError(
      400,
      tr(language, "공유 대시보드가 아니에요.", "Dashboard is not shared")
    );
  }

  const requesterMember = await prisma.groupMember.findFirst({
    where: {
      groupId: dashboard.groupId,
      userId: requester.id,
    },
  });
  if (!requesterMember || !isAdminRole(requesterMember.role)) {
    return jsonError(403, tr(language, "권한이 없어요.", "Forbidden"));
  }

  const targetMember = await prisma.groupMember.findFirst({
    where: {
      id: parsed.memberId,
      groupId: dashboard.groupId,
    },
  });
  if (!targetMember) {
    return jsonError(404, tr(language, "구성원을 찾을 수 없어요.", "Member not found"));
  }

  if (targetMember.userId && targetMember.userId === requester.id) {
    return jsonError(
      400,
      tr(language, "본인은 퇴출할 수 없어요.", "You cannot remove yourself.")
    );
  }

  const firstMember = await prisma.groupMember.findFirst({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firstMember?.id === targetMember.id) {
    return jsonError(
      400,
      tr(
        language,
        "첫 생성자는 퇴출할 수 없어요.",
        "You cannot remove the first creator."
      )
    );
  }

  await prisma.groupMember.delete({
    where: { id: targetMember.id },
  });

  const members = await prisma.groupMember.findMany({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    members: members.map(mapMember),
  });
}
