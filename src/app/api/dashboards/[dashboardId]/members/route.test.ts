import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforceRateLimit, publishDashboardUpdate, requireUser, prisma } =
  vi.hoisted(() => ({
    enforceRateLimit: vi.fn(),
    publishDashboardUpdate: vi.fn(),
    requireUser: vi.fn(),
    prisma: {
      dashboard: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      group: {
        create: vi.fn(),
      },
      groupMember: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
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

vi.mock("@/server/request-guards", () => ({
  enforceRateLimit,
  isSafeIdentifier: (value: string) => /^[a-z0-9_-]+$/i.test(value),
  parsePositiveIntEnv: (_value: string | undefined, fallback: number) => fallback,
}));

vi.mock("@/shared/i18n/language", () => ({
  detectLanguageFromRequest: vi.fn(() => "en"),
}));

vi.mock("@/server/dashboard-updates", () => ({
  publishDashboardUpdate,
}));

import { DELETE, PATCH, POST } from "./route";

function buildRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/dashboards/dash-1/members", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildParams() {
  return { params: Promise.resolve({ dashboardId: "dash-1" }) };
}

describe("dashboard members route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimit.mockResolvedValue({ ok: true });
  });

  it("creates a sharing group when inviting the first member", async () => {
    const updatedAt = new Date("2026-03-10T01:00:00.000Z");
    const createdAt = new Date("2026-03-10T00:00:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: {
          id: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          image: null,
        },
        email: "owner@example.com",
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: "owner-1",
      groupId: null,
    });
    prisma.group.create.mockResolvedValue({ id: "group-1" });
    prisma.dashboard.update.mockResolvedValue({
      id: "dash-1",
      groupId: "group-1",
      updatedAt,
    });
    prisma.groupMember.findMany.mockResolvedValue([
      {
        id: "member-owner",
        groupId: "group-1",
        role: "parent",
        displayName: "Owner",
        avatarUrl: null,
        email: "owner@example.com",
        userId: "owner-1",
        createdAt,
        updatedAt,
      },
      {
        id: "member-child",
        groupId: "group-1",
        role: "child",
        displayName: "child@example.com",
        avatarUrl: null,
        email: "child@example.com",
        userId: null,
        createdAt,
        updatedAt,
      },
    ]);

    const response = await POST(
      buildRequest("POST", { email: "child@example.com" }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      dashboard: {
        id: "dash-1",
        groupId: "group-1",
        updatedAt: updatedAt.toISOString(),
      },
      members: [
        {
          id: "member-owner",
          groupId: "group-1",
          role: "parent",
          displayName: "Owner",
          avatarUrl: undefined,
          email: "owner@example.com",
          userId: "owner-1",
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
        {
          id: "member-child",
          groupId: "group-1",
          role: "child",
          displayName: "child@example.com",
          avatarUrl: undefined,
          email: "child@example.com",
          userId: undefined,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
    expect(prisma.group.create).toHaveBeenCalledTimes(1);
    expect(prisma.groupMember.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.groupMember.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          email: "child@example.com",
          role: "child",
        }),
        update: expect.objectContaining({
          role: "child",
        }),
      })
    );
  });

  it("rejects attempts to add the requester as a member", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: {
          id: "owner-1",
          email: "owner@example.com",
        },
        email: "owner@example.com",
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      ownerId: "owner-1",
      groupId: null,
    });

    const response = await POST(
      buildRequest("POST", { email: "owner@example.com" }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Cannot add yourself");
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it("prevents demoting the first creator", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: {
          id: "admin-1",
        },
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      groupId: "group-1",
    });
    prisma.groupMember.findFirst
      .mockResolvedValueOnce({
        id: "member-admin",
        role: "parent",
      })
      .mockResolvedValueOnce({
        id: "member-creator",
      })
      .mockResolvedValueOnce({
        id: "member-creator",
      });

    const response = await PATCH(
      buildRequest("PATCH", { memberId: "member-creator", role: "child" }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("You cannot change the first creator's role.");
    expect(prisma.groupMember.update).not.toHaveBeenCalled();
  });

  it("collapses the sharing group when removing the last remaining member", async () => {
    const createdAt = new Date("2026-03-10T00:00:00.000Z");
    const updatedAt = new Date("2026-03-10T01:00:00.000Z");
    const updatedAt2 = new Date("2026-03-10T01:30:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: {
          id: "admin-2",
        },
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      groupId: "group-1",
      updatedAt,
    });
    prisma.groupMember.findFirst
      .mockResolvedValueOnce({
        id: "member-admin",
        role: "parent",
      })
      .mockResolvedValueOnce({
        id: "member-child",
        userId: "child-1",
      })
      .mockResolvedValueOnce({
        id: "member-creator",
      });
    prisma.groupMember.delete.mockResolvedValue({});
    prisma.groupMember.findMany.mockResolvedValue([
      {
        id: "member-creator",
        groupId: "group-1",
        role: "parent",
        displayName: "Creator",
        avatarUrl: null,
        email: "creator@example.com",
        userId: "creator-1",
        createdAt,
        updatedAt,
      },
    ]);
    prisma.dashboard.findMany
      .mockResolvedValueOnce([{ id: "dash-1" }, { id: "dash-2" }])
      .mockResolvedValueOnce([
        { id: "dash-1", groupId: null, updatedAt },
        { id: "dash-2", groupId: null, updatedAt: updatedAt2 },
      ]);
    prisma.dashboard.updateMany.mockResolvedValue({ count: 2 });
    prisma.groupMember.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      buildRequest("DELETE", { memberId: "member-child" }),
      buildParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      dashboard: {
        id: "dash-1",
        groupId: null,
        updatedAt: updatedAt.toISOString(),
      },
      removedGroupId: "group-1",
      members: [],
    });
    expect(prisma.dashboard.updateMany).toHaveBeenCalledWith({
      where: { groupId: "group-1" },
      data: {
        groupId: null,
        ownerId: "creator-1",
      },
    });
    expect(publishDashboardUpdate).toHaveBeenCalledTimes(2);
  });
});
