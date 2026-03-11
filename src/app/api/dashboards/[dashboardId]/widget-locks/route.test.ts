import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acquireWidgetLock,
  listActiveWidgetLocks,
  publishWidgetLockUpdate,
  releaseAllWidgetLocksByUser,
  releaseWidgetLock,
  requireUser,
  prisma,
} = vi.hoisted(() => ({
  acquireWidgetLock: vi.fn(),
  listActiveWidgetLocks: vi.fn(),
  publishWidgetLockUpdate: vi.fn(),
  releaseAllWidgetLocksByUser: vi.fn(),
  releaseWidgetLock: vi.fn(),
  requireUser: vi.fn(),
  prisma: {
    dashboard: {
      findUnique: vi.fn(),
    },
    groupMember: {
      findFirst: vi.fn(),
    },
    widget: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/api-auth", () => ({
  requireUser,
  isAdminRole: (role: string | null | undefined) =>
    role === "parent" || role === "admin",
}));

vi.mock("@/server/prisma", () => ({
  default: prisma,
}));

vi.mock("@/server/widget-locks", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/widget-locks")>(
      "@/server/widget-locks"
    );

  return {
    ...actual,
    acquireWidgetLock,
    listActiveWidgetLocks,
    releaseAllWidgetLocksByUser,
    releaseWidgetLock,
  };
});

vi.mock("@/server/widget-lock-updates", () => ({
  publishWidgetLockUpdate,
}));

import { WidgetLockConflictError } from "@/server/widget-locks";
import { DELETE, GET, POST } from "./route";

function buildParams() {
  return { params: Promise.resolve({ dashboardId: "dash-1" }) };
}

describe("dashboard widget locks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active locks for shared dashboards", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      role: "child",
      displayName: "Current User",
    });
    listActiveWidgetLocks.mockResolvedValue([
      {
        widgetId: "widget-1",
        userId: "user-1",
        displayName: "Current User",
        expiresAt: "2026-03-10T01:00:00.000Z",
        isMine: true,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/dashboards/dash-1/widget-locks"),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      enabled: true,
      ttlMs: 60_000,
      locks: [
        {
          widgetId: "widget-1",
          userId: "user-1",
          displayName: "Current User",
          expiresAt: "2026-03-10T01:00:00.000Z",
          isMine: true,
        },
      ],
    });
  });

  it("reports lock storage as disabled for personal dashboards", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: "user-1",
      groupId: null,
    });

    const response = await GET(
      new Request("http://localhost/api/dashboards/dash-1/widget-locks"),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, enabled: false, locks: [] });
    expect(listActiveWidgetLocks).not.toHaveBeenCalled();
  });

  it("returns a 423 response when another member already holds the lock", async () => {
    const expiresAt = new Date("2026-03-10T01:00:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        userId: "user-1",
        user: {
          name: "Current User",
          email: "current@example.com",
        },
        email: "current@example.com",
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      role: "child",
      displayName: "Current User",
    });
    prisma.widget.findUnique.mockResolvedValue({
      id: "widget-1",
      dashboardId: "dash-1",
    });
    acquireWidgetLock.mockRejectedValue(
      new WidgetLockConflictError({
        widgetId: "widget-1",
        dashboardId: "dash-1",
        userId: "other-user",
        displayName: "Other Member",
        expiresAt,
      })
    );

    const response = await POST(
      new Request("http://localhost/api/dashboards/dash-1/widget-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetId: "widget-1" }),
      }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body).toEqual({
      ok: false,
      error: "Widget is locked",
      lock: {
        widgetId: "widget-1",
        userId: "other-user",
        displayName: "Other Member",
        expiresAt: expiresAt.toISOString(),
        isMine: false,
      },
    });
    expect(publishWidgetLockUpdate).not.toHaveBeenCalled();
  });

  it("publishes an upsert event when a lock is successfully acquired", async () => {
    const lock = {
      widgetId: "widget-1",
      userId: "user-1",
      displayName: "Admin",
      expiresAt: "2026-03-10T01:00:00.000Z",
      isMine: true,
    };

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        userId: "user-1",
        user: {
          name: "Admin",
          email: "admin@example.com",
        },
        email: "admin@example.com",
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      role: "parent",
      displayName: "Admin",
    });
    prisma.widget.findUnique.mockResolvedValue({
      id: "widget-1",
      dashboardId: "dash-1",
    });
    acquireWidgetLock.mockResolvedValue(lock);

    const response = await POST(
      new Request("http://localhost/api/dashboards/dash-1/widget-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetId: "widget-1" }),
      }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      enabled: true,
      ttlMs: 60_000,
      lock,
    });
    expect(publishWidgetLockUpdate).toHaveBeenCalledWith({
      dashboardId: "dash-1",
      type: "upsert",
      lock: {
        widgetId: "widget-1",
        userId: "user-1",
        displayName: "Admin",
        expiresAt: "2026-03-10T01:00:00.000Z",
      },
    });
  });

  it("publishes delete events when releasing all locks for the current user", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      role: "parent",
      displayName: "Admin",
    });
    releaseAllWidgetLocksByUser.mockResolvedValue([
      {
        widgetId: "widget-1",
        userId: "user-1",
        displayName: "Admin",
        expiresAt: "2026-03-10T01:00:00.000Z",
        isMine: true,
      },
      {
        widgetId: "widget-2",
        userId: "user-1",
        displayName: "Admin",
        expiresAt: "2026-03-10T01:00:00.000Z",
        isMine: true,
      },
    ]);

    const response = await DELETE(
      new Request("http://localhost/api/dashboards/dash-1/widget-locks", {
        method: "DELETE",
      }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(releaseAllWidgetLocksByUser).toHaveBeenCalledWith("dash-1", "user-1");
    expect(publishWidgetLockUpdate).toHaveBeenCalledTimes(2);
    expect(publishWidgetLockUpdate).toHaveBeenNthCalledWith(1, {
      dashboardId: "dash-1",
      type: "delete",
      widgetId: "widget-1",
    });
    expect(publishWidgetLockUpdate).toHaveBeenNthCalledWith(2, {
      dashboardId: "dash-1",
      type: "delete",
      widgetId: "widget-2",
    });
  });

  it("returns a 423 response when releasing a specific widget lock conflicts", async () => {
    const expiresAt = new Date("2026-03-10T01:00:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      role: "child",
      displayName: "Current User",
    });
    prisma.widget.findUnique.mockResolvedValue({
      id: "widget-1",
      dashboardId: "dash-1",
    });
    releaseWidgetLock.mockRejectedValue(
      new WidgetLockConflictError({
        widgetId: "widget-1",
        dashboardId: "dash-1",
        userId: "other-user",
        displayName: "Other Member",
        expiresAt,
      })
    );

    const response = await DELETE(
      new Request(
        "http://localhost/api/dashboards/dash-1/widget-locks?widgetId=widget-1",
        {
          method: "DELETE",
        }
      ),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body).toEqual({
      ok: false,
      error: "Widget is locked",
      lock: {
        widgetId: "widget-1",
        userId: "other-user",
        displayName: "Other Member",
        expiresAt: expiresAt.toISOString(),
        isMine: false,
      },
    });
  });
});
