import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, publishDashboardUpdate, prisma } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  publishDashboardUpdate: vi.fn(),
  prisma: {
    dashboard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    groupMember: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/api-auth", () => ({
  requireUser,
}));

vi.mock("@/server/prisma", () => ({
  default: prisma,
}));

vi.mock("@/shared/i18n/language", () => ({
  detectLanguageFromRequest: vi.fn(() => "en"),
}));

vi.mock("@/server/dashboard-updates", () => ({
  publishDashboardUpdate,
}));

import { POST } from "./route";

function buildRequest() {
  return new Request("http://localhost/api/dashboards/dash-1/leave", {
    method: "POST",
  });
}

function buildParams() {
  return { params: Promise.resolve({ dashboardId: "dash-1" }) };
}

describe("POST /api/dashboards/[dashboardId]/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the first creator from leaving the dashboard", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: { id: "creator-1" },
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      groupId: "group-1",
    });
    prisma.groupMember.findFirst
      .mockResolvedValueOnce({ id: "member-creator" })
      .mockResolvedValueOnce({ id: "member-creator" });

    const response = await POST(buildRequest(), buildParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Creator cannot leave dashboard");
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it("converts shared dashboards back to personal when one member remains", async () => {
    const updatedAt = new Date("2026-03-10T01:00:00.000Z");
    const updatedAt2 = new Date("2026-03-10T01:30:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: { id: "parent-2" },
      },
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dash-1",
      groupId: "group-1",
    });
    prisma.groupMember.findFirst
      .mockResolvedValueOnce({ id: "member-parent-2" })
      .mockResolvedValueOnce({ id: "member-creator" });
    prisma.groupMember.findMany.mockResolvedValue([{ userId: "creator-1" }]);
    prisma.dashboard.findMany
      .mockResolvedValueOnce([{ id: "dash-1" }, { id: "dash-2" }])
      .mockResolvedValueOnce([
        { id: "dash-1", groupId: null, updatedAt },
        { id: "dash-2", groupId: null, updatedAt: updatedAt2 },
      ]);
    prisma.dashboard.updateMany.mockResolvedValue({ count: 2 });
    prisma.groupMember.delete.mockResolvedValue({});
    prisma.groupMember.deleteMany.mockResolvedValue({ count: 1 });

    const response = await POST(buildRequest(), buildParams());
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
