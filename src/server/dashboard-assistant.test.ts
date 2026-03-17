import { describe, expect, it, vi } from "vitest";

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
