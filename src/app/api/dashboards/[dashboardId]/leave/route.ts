import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import { isSafeIdentifier } from "@/server/request-guards";
import { detectLanguageFromRequest } from "@/shared/i18n/language";
import { publishDashboardUpdate } from "@/server/dashboard-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tr(language: "ko" | "en", ko: string, en: string) {
  return language === "ko" ? ko : en;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const language = detectLanguageFromRequest(request);
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { user: requester } = userResult.context;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, tr(language, "대시보드 ID 형식이 올바르지 않아요.", "Invalid dashboard ID"));
  }

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, groupId: true },
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
    select: { id: true },
  });
  if (!requesterMember) {
    return jsonError(403, tr(language, "권한이 없어요.", "Forbidden"));
  }

  const firstMember = await prisma.groupMember.findFirst({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firstMember?.id === requesterMember.id) {
    return jsonError(
      400,
      tr(
        language,
        "대시보드를 처음 만든 사용자는 나갈 수 없어요.",
        "Creator cannot leave dashboard"
      )
    );
  }

  await prisma.groupMember.delete({
    where: { id: requesterMember.id },
  });

  const remainingMembers = await prisma.groupMember.findMany({
    where: { groupId: dashboard.groupId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  let nextDashboard: {
    id: string;
    groupId: string | null;
    updatedAt: string;
  } = {
    id: dashboard.id,
    groupId: dashboard.groupId,
    updatedAt: new Date().toISOString(),
  };
  if (remainingMembers.length <= 1) {
    const updated = await prisma.dashboard.update({
      where: { id: dashboard.id },
      data: {
        groupId: null,
        ...(remainingMembers[0]?.userId
          ? { ownerId: remainingMembers[0].userId }
          : {}),
      },
      select: { id: true, groupId: true, updatedAt: true },
    });
    await prisma.groupMember.deleteMany({
      where: { groupId: dashboard.groupId },
    });
    nextDashboard = {
      id: updated.id,
      groupId: updated.groupId,
      updatedAt: updated.updatedAt.toISOString(),
    };
    publishDashboardUpdate({
      dashboardId: updated.id,
      updatedAt: nextDashboard.updatedAt,
    });
  }

  return NextResponse.json({
    ok: true,
    dashboard: nextDashboard,
    removedGroupId: dashboard.groupId,
  });
}
