import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, prisma } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  prisma: {
    groupMember: {
      findMany: vi.fn(),
    },
    dashboard: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/api-auth", () => ({
  requireUser,
}));

vi.mock("@/server/prisma", () => ({
  default: prisma,
}));

import { GET } from "./route";

describe("GET /api/dashboards", () => {
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

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns owned and shared dashboards without duplicates", async () => {
    const createdAt = new Date("2026-03-10T00:00:00.000Z");
    const updatedAt = new Date("2026-03-10T01:00:00.000Z");
    const sharedUpdatedAt = new Date("2026-03-10T02:00:00.000Z");

    requireUser.mockResolvedValue({
      ok: true,
      context: {
        user: { id: "user-1" },
      },
    });
    prisma.groupMember.findMany.mockResolvedValue([{ groupId: "group-1" }]);
    prisma.dashboard.findMany
      .mockResolvedValueOnce([
        {
          id: "owned-1",
          name: "Owned",
          ownerId: "user-1",
          groupId: null,
          createdAt,
          updatedAt,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "owned-1",
          name: "Owned duplicate",
          ownerId: "user-1",
          groupId: "group-1",
          createdAt,
          updatedAt: sharedUpdatedAt,
        },
        {
          id: "shared-1",
          name: "Shared",
          ownerId: "owner-2",
          groupId: "group-1",
          createdAt,
          updatedAt: sharedUpdatedAt,
        },
      ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      dashboards: [
        {
          id: "owned-1",
          name: "Owned",
          ownerId: "user-1",
          groupId: null,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
        {
          id: "shared-1",
          name: "Shared",
          ownerId: "owner-2",
          groupId: "group-1",
          createdAt: createdAt.toISOString(),
          updatedAt: sharedUpdatedAt.toISOString(),
        },
      ],
    });
  });
});
