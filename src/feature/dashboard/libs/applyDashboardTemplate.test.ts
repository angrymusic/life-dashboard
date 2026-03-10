import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const { db, resetState, state } = vi.hoisted(() => {
  const state = {
    widgets: [] as Row[],
    memos: [] as Row[],
    todos: [] as Row[],
    ddays: [] as Row[],
    localPhotos: [] as Row[],
    moods: [] as Row[],
    notices: [] as Row[],
    metrics: [] as Row[],
    metricEntries: [] as Row[],
    calendarEvents: [] as Row[],
    weatherCache: [] as Row[],
    outbox: [] as Row[],
  };

  function makeTable(key: keyof typeof state) {
    return {
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => ({
          toArray: vi.fn(async () =>
            state[key].filter((row) => row[field] === value)
          ),
          delete: vi.fn(async () => {
            const nextRows = state[key].filter((row) => row[field] !== value);
            const deletedCount = state[key].length - nextRows.length;
            state[key] = nextRows;
            return deletedCount;
          }),
        })),
      })),
      bulkPut: vi.fn(async (rows: Row[]) => {
        const nextRows = [...state[key]];
        for (const row of rows) {
          const rowId = row.id;
          const existingIndex = nextRows.findIndex(
            (existingRow) => existingRow.id === rowId
          );
          if (existingIndex >= 0) {
            nextRows[existingIndex] = row;
            continue;
          }
          nextRows.push(row);
        }
        state[key] = nextRows;
      }),
    };
  }

  const db = {
    widgets: makeTable("widgets"),
    memos: makeTable("memos"),
    todos: makeTable("todos"),
    ddays: makeTable("ddays"),
    localPhotos: makeTable("localPhotos"),
    moods: makeTable("moods"),
    notices: makeTable("notices"),
    metrics: makeTable("metrics"),
    metricEntries: makeTable("metricEntries"),
    calendarEvents: makeTable("calendarEvents"),
    weatherCache: makeTable("weatherCache"),
    outbox: makeTable("outbox"),
    transaction: vi.fn(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) =>
        callback()
    ),
  };

  function resetState(nextState?: Partial<typeof state>) {
    state.widgets = nextState?.widgets ?? [];
    state.memos = nextState?.memos ?? [];
    state.todos = nextState?.todos ?? [];
    state.ddays = nextState?.ddays ?? [];
    state.localPhotos = nextState?.localPhotos ?? [];
    state.moods = nextState?.moods ?? [];
    state.notices = nextState?.notices ?? [];
    state.metrics = nextState?.metrics ?? [];
    state.metricEntries = nextState?.metricEntries ?? [];
    state.calendarEvents = nextState?.calendarEvents ?? [];
    state.weatherCache = nextState?.weatherCache ?? [];
    state.outbox = nextState?.outbox ?? [];
  }

  return { db, resetState, state };
});

vi.mock("@/shared/db/db", () => ({
  addCalendarEvent: vi.fn(),
  addDday: vi.fn(),
  addMetricEntry: vi.fn(),
  addMood: vi.fn(),
  addTodoItem: vi.fn(),
  addWidget: vi.fn(),
  createDashboard: vi.fn(),
  createMetric: vi.fn(),
  db,
  deleteDashboardCascade: vi.fn(),
  getOrCreateLocalProfileId: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(() => "2026-03-10T00:00:00.000Z"),
}));

import { clearTemplateDashboardData } from "./applyDashboardTemplate";

describe("clearTemplateDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it("preserves dashboard and pending delete outbox events while clearing template data", async () => {
    resetState({
      widgets: [
        { id: "widget-1", dashboardId: "dashboard-1" },
        { id: "widget-2", dashboardId: "dashboard-2" },
      ],
      todos: [
        { id: "todo-1", dashboardId: "dashboard-1", widgetId: "widget-1" },
        { id: "todo-2", dashboardId: "dashboard-2", widgetId: "widget-2" },
      ],
      outbox: [
        {
          id: "dashboard:dashboard-1",
          entityType: "dashboard",
          entityId: "dashboard-1",
          dashboardId: "dashboard-1",
          operation: "upsert",
        },
        {
          id: "widget:widget-1",
          entityType: "widget",
          entityId: "widget-1",
          dashboardId: "dashboard-1",
          widgetId: "widget-1",
          operation: "upsert",
        },
        {
          id: "widget:widget-deleted-1",
          entityType: "widget",
          entityId: "widget-deleted-1",
          dashboardId: "dashboard-1",
          widgetId: "widget-deleted-1",
          operation: "delete",
        },
        {
          id: "todo:todo-deleted-1",
          entityType: "todo",
          entityId: "todo-deleted-1",
          dashboardId: "dashboard-1",
          widgetId: "widget-deleted-1",
          operation: "delete",
        },
        {
          id: "widget:widget-2",
          entityType: "widget",
          entityId: "widget-2",
          dashboardId: "dashboard-2",
          widgetId: "widget-2",
          operation: "upsert",
        },
      ],
    });

    await clearTemplateDashboardData("dashboard-1");

    expect(state.widgets).toEqual([{ id: "widget-2", dashboardId: "dashboard-2" }]);
    expect(state.todos).toEqual([
      { id: "todo-2", dashboardId: "dashboard-2", widgetId: "widget-2" },
    ]);
    expect(state.outbox).toEqual([
      {
        id: "widget:widget-2",
        entityType: "widget",
        entityId: "widget-2",
        dashboardId: "dashboard-2",
        widgetId: "widget-2",
        operation: "upsert",
      },
      {
        id: "dashboard:dashboard-1",
        entityType: "dashboard",
        entityId: "dashboard-1",
        dashboardId: "dashboard-1",
        operation: "upsert",
      },
      {
        id: "widget:widget-deleted-1",
        entityType: "widget",
        entityId: "widget-deleted-1",
        dashboardId: "dashboard-1",
        widgetId: "widget-deleted-1",
        operation: "delete",
      },
      {
        id: "todo:todo-deleted-1",
        entityType: "todo",
        entityId: "todo-deleted-1",
        dashboardId: "dashboard-1",
        widgetId: "widget-deleted-1",
        operation: "delete",
      },
    ]);
  });
});
