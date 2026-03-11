import { describe, expect, it, vi } from "vitest";
import {
  persistSnapshot,
  serializeSnapshot,
  validateSnapshotPayload,
} from "./snapshot-pipeline";

const VALID_STORAGE_PATH =
  "photos/dash-1/2026/03/550e8400-e29b-41d4-a716-446655440000.jpg";

describe("snapshot-pipeline", () => {
  it("rejects snapshot payloads whose dashboard id does not match the route", () => {
    const result = validateSnapshotPayload(
      {
        dashboard: {
          id: "other-dashboard",
          name: "Family",
        },
      },
      "dash-1"
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Dashboard ID mismatch",
    });
  });

  it("rejects photos stored outside the dashboard scope", () => {
    const result = validateSnapshotPayload(
      {
        dashboard: {
          id: "dash-1",
          name: "Family",
        },
        photos: [
          {
            storagePath:
              "photos/other-dashboard/2026/03/550e8400-e29b-41d4-a716-446655440000.jpg",
          },
        ],
      },
      "dash-1"
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Invalid photo path",
    });
  });

  it("serializes snapshot entities into database inputs", () => {
    const createdAt = "2026-03-10T00:00:00.000Z";
    const updatedAt = "2026-03-10T01:00:00.000Z";
    const startAt = "2026-03-10T09:00:00.000Z";
    const fetchedAt = "2026-03-10T02:00:00.000Z";

    const serialized = serializeSnapshot(
      {
        dashboard: {
          id: "dash-1",
          name: "  Family Dashboard  ",
        },
        widgets: [
          {
            id: "widget-1",
            type: "memo",
            layout: { x: 0, y: 0, w: 3, h: 4 },
            createdAt,
            updatedAt,
          },
        ],
        memos: [
          {
            id: "memo-1",
            widgetId: "widget-1",
            text: null,
            createdAt,
            updatedAt,
          },
        ],
        photos: [
          {
            id: "photo-1",
            widgetId: "widget-1",
            storagePath: VALID_STORAGE_PATH,
            mimeType: "image/jpeg",
            createdAt,
            updatedAt,
          },
        ],
        calendarEvents: [
          {
            id: "event-1",
            widgetId: "widget-1",
            title: "Trip",
            startAt,
            createdAt,
            updatedAt,
          },
        ],
        weatherCache: [
          {
            id: "weather-1",
            widgetId: "widget-1",
            locationKey: "seoul",
            payload: { temperature: 11 },
            fetchedAt,
            createdAt,
            updatedAt,
          },
        ],
      },
      "dash-1"
    );

    expect(serialized).toEqual(
      expect.objectContaining({
        dashboardId: "dash-1",
        dashboardName: "Family Dashboard",
        groupId: null,
        widgets: [
          expect.objectContaining({
            id: "widget-1",
            dashboardId: "dash-1",
            type: "memo",
            layout: { x: 0, y: 0, w: 3, h: 4 },
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ],
        memos: [
          expect.objectContaining({
            id: "memo-1",
            widgetId: "widget-1",
            dashboardId: "dash-1",
            text: "",
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ],
        photos: [
          expect.objectContaining({
            id: "photo-1",
            widgetId: "widget-1",
            dashboardId: "dash-1",
            storagePath: VALID_STORAGE_PATH,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ],
        calendarEvents: [
          expect.objectContaining({
            id: "event-1",
            widgetId: "widget-1",
            dashboardId: "dash-1",
            title: "Trip",
            startAt: new Date(startAt),
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ],
        weatherCache: [
          expect.objectContaining({
            id: "weather-1",
            widgetId: "widget-1",
            dashboardId: "dash-1",
            locationKey: "seoul",
            payload: { temperature: 11 },
            fetchedAt: new Date(fetchedAt),
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ],
      })
    );
  });

  it("persists the snapshot in dashboard-first order and skips empty collections", async () => {
    const tx = {
      metricEntry: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      metric: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      memo: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      todo: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      dday: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      photo: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      mood: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      notice: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      calendarEvent: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      weatherCache: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      widget: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      dashboard: {
        upsert: vi.fn(),
      },
    };

    await persistSnapshot(
      tx as unknown as Parameters<typeof persistSnapshot>[0],
      {
        dashboardId: "dash-1",
        dashboardName: "Family",
        groupId: "group-1",
        widgets: [
          {
            id: "widget-1",
            dashboardId: "dash-1",
            type: "memo",
            layout: {},
            createdAt: new Date("2026-03-10T00:00:00.000Z"),
            updatedAt: new Date("2026-03-10T01:00:00.000Z"),
          },
        ],
        memos: [],
        todos: [],
        ddays: [],
        photos: [],
        moods: [],
        notices: [],
        metrics: [],
        metricEntries: [],
        calendarEvents: [],
        weatherCache: [],
      },
      {
        userId: "user-1",
        existing: null,
        resolvedGroupId: "group-1",
      }
    );

    expect(tx.widget.deleteMany).toHaveBeenCalledWith({
      where: { dashboardId: "dash-1" },
    });
    expect(tx.metricEntry.deleteMany).toHaveBeenCalledWith({
      where: { dashboardId: "dash-1" },
    });
    expect(tx.dashboard.upsert).toHaveBeenCalledWith({
      where: { id: "dash-1" },
      update: {
        name: "Family",
        ownerId: "user-1",
        groupId: "group-1",
      },
      create: {
        id: "dash-1",
        name: "Family",
        ownerId: "user-1",
        groupId: "group-1",
      },
    });
    expect(tx.widget.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: "widget-1",
          dashboardId: "dash-1",
        }),
      ],
    });
    expect(tx.memo.createMany).not.toHaveBeenCalled();
  });
});
