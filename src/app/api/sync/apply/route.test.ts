import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, prisma } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  prisma: {
    dashboard: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    groupMember: {
      findFirst: vi.fn(),
    },
    widget: {
      findUnique: vi.fn(),
    },
    memo: {
      upsert: vi.fn(),
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

import { POST } from "./route";

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/sync/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sync/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await POST(buildRequest({ events: [] }));
    expect(response.status).toBe(401);
  });

  it("rejects dashboard upserts for non-admin shared members", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "user-1" },
    });
    prisma.dashboard.findUnique.mockResolvedValue(null);
    prisma.groupMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: "child",
    });

    const response = await POST(
      buildRequest({
        events: [
          {
            id: "dashboard:dash-1",
            entityType: "dashboard",
            entityId: "dash-1",
            operation: "upsert",
            payload: {
              id: "dash-1",
              name: "Family",
              groupId: "group-1",
            },
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.appliedIds).toEqual([]);
    expect(body.errors).toEqual([
      { id: "dashboard:dash-1", error: "Forbidden" },
    ]);
    expect(prisma.dashboard.upsert).not.toHaveBeenCalled();
  });

  it("applies memo updates when a child edits their own widget", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "child-1" },
    });
    prisma.widget.findUnique.mockResolvedValue({
      id: "widget-1",
      dashboardId: "dashboard-1",
      createdBy: "child-1",
    });
    prisma.dashboard.findUnique.mockResolvedValue({
      id: "dashboard-1",
      ownerId: null,
      groupId: "group-1",
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: "child",
    });
    prisma.memo.upsert.mockResolvedValue({});
    prisma.dashboard.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      buildRequest({
        events: [
          {
            id: "memo:memo-1",
            entityType: "memo",
            entityId: "memo-1",
            operation: "upsert",
            dashboardId: "dashboard-1",
            widgetId: "widget-1",
            payload: {
              id: "memo-1",
              dashboardId: "dashboard-1",
              widgetId: "widget-1",
              text: "hello",
            },
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.appliedIds).toEqual(["memo:memo-1"]);
    expect(body.errors).toBeUndefined();
    expect(prisma.memo.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.dashboard.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns partial success for mixed permission outcomes", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      context: { userId: "child-1" },
    });
    prisma.dashboard.findUnique.mockImplementation(async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === "new-dashboard") return null;
      if (args?.where?.id === "existing-dashboard") {
        return {
          id: "existing-dashboard",
          ownerId: null,
          groupId: "group-1",
        };
      }
      return null;
    });
    prisma.groupMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: "child",
    });
    prisma.widget.findUnique.mockResolvedValue({
      id: "widget-1",
      dashboardId: "existing-dashboard",
      createdBy: "child-1",
    });
    prisma.memo.upsert.mockResolvedValue({});
    prisma.dashboard.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      buildRequest({
        events: [
          {
            id: "dashboard:new-dashboard",
            entityType: "dashboard",
            entityId: "new-dashboard",
            operation: "upsert",
            payload: {
              id: "new-dashboard",
              name: "Forbidden Create",
              groupId: "group-1",
            },
          },
          {
            id: "memo:memo-1",
            entityType: "memo",
            entityId: "memo-1",
            operation: "upsert",
            dashboardId: "existing-dashboard",
            widgetId: "widget-1",
            payload: {
              id: "memo-1",
              dashboardId: "existing-dashboard",
              widgetId: "widget-1",
              text: "still applied",
            },
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.appliedIds).toEqual(["memo:memo-1"]);
    expect(body.errors).toEqual([
      { id: "dashboard:new-dashboard", error: "Forbidden" },
    ]);
    expect(prisma.memo.upsert).toHaveBeenCalledTimes(1);
  });
});
