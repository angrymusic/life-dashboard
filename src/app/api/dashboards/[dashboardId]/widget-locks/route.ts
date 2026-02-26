import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError, parseJson } from "@/server/api-response";
import { isAdminRole, requireUser } from "@/server/api-auth";
import { isSafeIdentifier } from "@/server/request-guards";
import {
  acquireWidgetLock,
  getWidgetLockTtlMs,
  listActiveWidgetLocks,
  releaseAllWidgetLocksByUser,
  releaseWidgetLock,
  WidgetLockConflictError,
  WidgetLockUnavailableError,
} from "@/server/widget-locks";
import { publishWidgetLockUpdate } from "@/server/widget-lock-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessContext = {
  dashboard: {
    id: string;
    ownerId: string | null;
    groupId: string | null;
  };
  memberRole?: string;
  memberDisplayName?: string;
};

function parseForceFlag(value: unknown) {
  if (typeof value !== "boolean") return false;
  return value;
}

function parseForceFromSearchParams(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

async function ensureAccess(
  dashboardId: string,
  userId: string
): Promise<AccessContext | null> {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true },
  });
  if (!dashboard) return null;

  if (dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: dashboard.groupId, userId },
      select: { role: true, displayName: true },
    });
    if (!member) return null;
    return {
      dashboard,
      memberRole: member.role,
      memberDisplayName: member.displayName,
    };
  }

  if (!dashboard.ownerId || dashboard.ownerId !== userId) return null;
  return { dashboard };
}

function resolveDisplayName(params: {
  memberDisplayName?: string;
  userName?: string | null;
  email?: string | null;
}) {
  const memberName = params.memberDisplayName?.trim();
  if (memberName) return memberName;
  const userName = params.userName?.trim();
  if (userName) return userName;
  const email = params.email?.trim();
  if (email) return email;
  return "Member";
}

function buildConflictResponse(error: WidgetLockConflictError, currentUserId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "Widget is locked",
      lock: {
        widgetId: error.lock.widgetId,
        userId: error.lock.userId,
        displayName: error.lock.displayName,
        expiresAt: error.lock.expiresAt.toISOString(),
        isMine: error.lock.userId === currentUserId,
      },
    },
    { status: 423 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { userId } = userResult.context;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }

  const access = await ensureAccess(dashboardId, userId);
  if (!access) return jsonError(404, "Dashboard not found");

  if (!access.dashboard.groupId) {
    return NextResponse.json({ ok: true, enabled: false, locks: [] });
  }

  let locks;
  try {
    locks = await listActiveWidgetLocks(dashboardId, userId);
  } catch (error) {
    if (error instanceof WidgetLockUnavailableError) {
      return NextResponse.json({ ok: true, enabled: false, locks: [] });
    }
    throw error;
  }
  return NextResponse.json({
    ok: true,
    enabled: true,
    ttlMs: getWidgetLockTtlMs(),
    locks,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { userId, user, email } = userResult.context;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }
  const access = await ensureAccess(dashboardId, userId);
  if (!access) return jsonError(404, "Dashboard not found");

  if (!access.dashboard.groupId) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  const parsed = await parseJson(request, { maxBytes: 16 * 1024 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body !== "object" || body === null) {
    return jsonError(400, "Invalid request body");
  }

  const widgetId = (body as { widgetId?: unknown }).widgetId;
  if (typeof widgetId !== "string" || !isSafeIdentifier(widgetId)) {
    return jsonError(400, "Invalid widget ID");
  }

  const widget = await prisma.widget.findUnique({
    where: { id: widgetId },
    select: { id: true, dashboardId: true },
  });
  if (!widget || widget.dashboardId !== dashboardId) {
    return jsonError(404, "Widget not found");
  }

  const force = parseForceFlag((body as { force?: unknown }).force);
  const canForce = Boolean(access.memberRole && isAdminRole(access.memberRole));

  try {
    const lock = await acquireWidgetLock({
      widgetId,
      dashboardId,
      userId,
      displayName: resolveDisplayName({
        memberDisplayName: access.memberDisplayName,
        userName: user.name,
        email: email ?? user.email,
      }),
      force,
      canForce,
    });
    publishWidgetLockUpdate({
      dashboardId,
      type: "upsert",
      lock: {
        widgetId: lock.widgetId,
        userId: lock.userId,
        displayName: lock.displayName,
        expiresAt: lock.expiresAt,
      },
    });
    return NextResponse.json({
      ok: true,
      enabled: true,
      ttlMs: getWidgetLockTtlMs(),
      lock,
    });
  } catch (error) {
    if (error instanceof WidgetLockUnavailableError) {
      return NextResponse.json({ ok: true, enabled: false });
    }
    if (error instanceof WidgetLockConflictError) {
      return buildConflictResponse(error, userId);
    }
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { userId } = userResult.context;

  const { dashboardId } = await params;
  if (!isSafeIdentifier(dashboardId)) {
    return jsonError(400, "Invalid dashboard ID");
  }
  const access = await ensureAccess(dashboardId, userId);
  if (!access) return jsonError(404, "Dashboard not found");

  if (!access.dashboard.groupId) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  const url = new URL(request.url);
  const widgetId = url.searchParams.get("widgetId");
  const force = parseForceFromSearchParams(url.searchParams.get("force"));
  const canForce = Boolean(access.memberRole && isAdminRole(access.memberRole));

  if (!widgetId) {
    try {
      const releasedLocks = await releaseAllWidgetLocksByUser(dashboardId, userId);
      for (const lock of releasedLocks) {
        publishWidgetLockUpdate({
          dashboardId,
          type: "delete",
          widgetId: lock.widgetId,
        });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof WidgetLockUnavailableError) {
        return NextResponse.json({ ok: true, enabled: false });
      }
      throw error;
    }
  }

  if (!isSafeIdentifier(widgetId)) {
    return jsonError(400, "Invalid widget ID");
  }

  const widget = await prisma.widget.findUnique({
    where: { id: widgetId },
    select: { id: true, dashboardId: true },
  });
  if (!widget || widget.dashboardId !== dashboardId) {
    return jsonError(404, "Widget not found");
  }

  try {
    const released = await releaseWidgetLock({
      widgetId,
      userId,
      force,
      canForce,
    });
    if (released) {
      publishWidgetLockUpdate({
        dashboardId,
        type: "delete",
        widgetId: released.widgetId,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WidgetLockUnavailableError) {
      return NextResponse.json({ ok: true, enabled: false });
    }
    if (error instanceof WidgetLockConflictError) {
      return buildConflictResponse(error, userId);
    }
    throw error;
  }
}
