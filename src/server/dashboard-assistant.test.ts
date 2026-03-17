import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  prisma,
  expandCalendarEvents,
  parseOpenMeteoDaily,
  generateTextWithGemini,
} = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    weeklySummary: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    todo: {
      findMany: vi.fn(),
    },
    mood: {
      findMany: vi.fn(),
    },
    memo: {
      findMany: vi.fn(),
    },
    calendarEvent: {
      findMany: vi.fn(),
    },
    metricEntry: {
      findMany: vi.fn(),
    },
    dday: {
      findMany: vi.fn(),
    },
    photo: {
      findMany: vi.fn(),
    },
    notice: {
      findMany: vi.fn(),
    },
    weatherCache: {
      findMany: vi.fn(),
    },
  },
  expandCalendarEvents: vi.fn(),
  parseOpenMeteoDaily: vi.fn(),
  generateTextWithGemini: vi.fn(),
}));

vi.mock("@/server/prisma", () => ({
  default: prisma,
}));

vi.mock("@/feature/widgets/Calendar/libs/calendarUtils", () => ({
  expandCalendarEvents,
}));

vi.mock("@/feature/widgets/Weather/libs/openMeteo", () => ({
  parseOpenMeteoDaily,
}));

vi.mock("@/server/gemini", () => ({
  generateTextWithGemini,
}));

import {
  getOrCreateWeeklySummary,
  validateSummaryWindow,
} from "./dashboard-assistant";

describe("validateSummaryWindow", () => {
  it("accepts ISO bounds that match the requested window in another timezone", () => {
    const result = validateSummaryWindow({
      windowStartYmd: "2026-03-11",
      windowEndYmd: "2026-03-18",
      windowStartAt: "2026-03-10T15:00:00.000Z",
      windowEndAt: "2026-03-17T15:00:00.000Z",
    });

    expect(result).not.toBeNull();
  });

  it("accepts DST-shifted local midnights for the requested window", () => {
    const result = validateSummaryWindow({
      windowStartYmd: "2026-03-08",
      windowEndYmd: "2026-03-15",
      windowStartAt: "2026-03-08T08:00:00.000Z",
      windowEndAt: "2026-03-15T07:00:00.000Z",
    });

    expect(result).not.toBeNull();
  });

  it("rejects ISO bounds that do not line up with the requested YMD window", () => {
    const result = validateSummaryWindow({
      windowStartYmd: "2026-03-11",
      windowEndYmd: "2026-03-18",
      windowStartAt: "2026-03-01T15:00:00.000Z",
      windowEndAt: "2026-03-17T15:00:00.000Z",
    });

    expect(result).toBeNull();
  });
});

describe("getOrCreateWeeklySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.weeklySummary.findUnique.mockResolvedValue(null);
    prisma.weeklySummary.upsert.mockResolvedValue({
      status: "pending",
    });
    prisma.weeklySummary.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        status: "ready",
        summaryKo:
          typeof data.summaryKo === "string" ? data.summaryKo : null,
        summaryEn:
          typeof data.summaryEn === "string" ? data.summaryEn : null,
        stats: (data.stats as Prisma.JsonValue) ?? Prisma.JsonNull,
        generatedAt:
          data.generatedAt instanceof Date ? data.generatedAt : new Date(),
        error: null,
        model: typeof data.model === "string" ? data.model : null,
        windowStartYmd: "2026-03-11",
        windowEndYmd: "2026-03-18",
      }),
    );
    prisma.todo.findMany.mockResolvedValue([]);
    prisma.mood.findMany.mockResolvedValue([]);
    prisma.memo.findMany.mockResolvedValue([]);
    prisma.calendarEvent.findMany.mockResolvedValue([]);
    prisma.metricEntry.findMany.mockResolvedValue([]);
    prisma.dday.findMany.mockResolvedValue([]);
    prisma.photo.findMany.mockResolvedValue([]);
    prisma.notice.findMany.mockResolvedValue([]);
    prisma.weatherCache.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockImplementation(async () => [{ locked: true }]);
    expandCalendarEvents.mockReturnValue([]);
    parseOpenMeteoDaily.mockReturnValue([]);
  });

  it("returns a ready fallback summary when the Gemini API key is missing", async () => {
    generateTextWithGemini.mockRejectedValue(
      new Error("Missing GEMINI_API_KEY"),
    );

    const result = await getOrCreateWeeklySummary({
      widgetId: "widget-1",
      dashboardId: "dashboard-1",
      windowStartYmd: "2026-03-11",
      windowEndYmd: "2026-03-18",
      windowStartAt: "2026-03-10T15:00:00.000Z",
      windowEndAt: "2026-03-17T15:00:00.000Z",
      startAt: new Date("2026-03-10T15:00:00.000Z"),
      endAt: new Date("2026-03-17T15:00:00.000Z"),
      language: "en",
    });

    expect(result.status).toBe("ready");
    expect(result.model).toBe("rule-based-fallback");
    expect(result.summary).toContain("last 7 days");
    expect(prisma.weeklySummary.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ready",
          model: "rule-based-fallback",
          error: null,
        }),
      }),
    );
  });
});
