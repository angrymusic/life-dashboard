import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    widgetLock: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/prisma", () => ({
  default: prisma,
}));

import {
  WidgetLockConflictError,
  acquireWidgetLock,
  ensureWidgetLockWriteAccess,
  listActiveWidgetLocks,
  releaseWidgetLock,
} from "./widget-locks";

describe("widget-locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
  });

  it("lists only active locks and marks locks owned by the current user", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    prisma.widgetLock.deleteMany.mockResolvedValue({ count: 1 });
    prisma.widgetLock.findMany.mockResolvedValue([
      {
        widgetId: "widget-1",
        dashboardId: "dash-1",
        userId: "user-1",
        displayName: "Me",
        expiresAt,
      },
      {
        widgetId: "widget-2",
        dashboardId: "dash-1",
        userId: "user-2",
        displayName: "Other",
        expiresAt,
      },
    ]);

    const locks = await listActiveWidgetLocks("dash-1", "user-1");

    expect(locks).toEqual([
      {
        widgetId: "widget-1",
        userId: "user-1",
        displayName: "Me",
        expiresAt: expiresAt.toISOString(),
        isMine: true,
      },
      {
        widgetId: "widget-2",
        userId: "user-2",
        displayName: "Other",
        expiresAt: expiresAt.toISOString(),
        isMine: false,
      },
    ]);
    expect(prisma.widgetLock.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("allows admins to force-acquire an existing lock", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    prisma.widgetLock.deleteMany.mockResolvedValue({ count: 0 });
    prisma.widgetLock.upsert.mockResolvedValue({
      widgetId: "widget-1",
      dashboardId: "dash-1",
      userId: "admin-1",
      displayName: "Admin",
      expiresAt,
    });

    const lock = await acquireWidgetLock({
      widgetId: "widget-1",
      dashboardId: "dash-1",
      userId: "admin-1",
      displayName: "Admin",
      force: true,
      canForce: true,
    });

    expect(lock).toEqual({
      widgetId: "widget-1",
      userId: "admin-1",
      displayName: "Admin",
      expiresAt: expiresAt.toISOString(),
      isMine: true,
    });
    expect(prisma.widgetLock.upsert).toHaveBeenCalledTimes(1);
  });

  it("allows admins to force-release another member's active lock", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    prisma.widgetLock.deleteMany.mockResolvedValue({ count: 0 });
    prisma.widgetLock.findUnique.mockResolvedValue({
      widgetId: "widget-1",
      dashboardId: "dash-1",
      userId: "user-2",
      displayName: "Other",
      expiresAt,
    });

    const released = await releaseWidgetLock({
      widgetId: "widget-1",
      userId: "admin-1",
      force: true,
      canForce: true,
    });

    expect(released).toEqual({
      widgetId: "widget-1",
      userId: "user-2",
      displayName: "Other",
      expiresAt: expiresAt.toISOString(),
      isMine: false,
    });
    expect(prisma.widgetLock.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        widgetId: "widget-1",
        userId: undefined,
      },
    });
  });

  it("blocks writes when another member holds the active lock", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    prisma.widgetLock.deleteMany.mockResolvedValue({ count: 0 });
    prisma.widgetLock.findUnique.mockResolvedValue({
      widgetId: "widget-1",
      dashboardId: "dash-1",
      userId: "user-2",
      displayName: "Other",
      expiresAt,
    });

    await expect(
      ensureWidgetLockWriteAccess("widget-1", "user-1")
    ).rejects.toBeInstanceOf(WidgetLockConflictError);
  });
});
