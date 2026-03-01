import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/shared/db/schema";
import {
  expandCalendarEvents,
  findSolarDateForLunarDate,
  formatLunarMonthDayLabel,
  getLunarDateInfo,
  startOfDay,
  toYmd,
} from "@/feature/widgets/Calendar/libs/calendarUtils";

describe("calendarUtils lunar helpers", () => {
  it("parses lunar date from a solar date", () => {
    const lunar = getLunarDateInfo(new Date(2026, 6, 22));
    expect(lunar).not.toBeNull();
    expect(lunar?.year).toBe(2026);
    expect(lunar?.month).toBe(6);
    expect(lunar?.day).toBe(9);
    expect(lunar?.isLeapMonth).toBe(false);
  });

  it("converts lunar date to solar date in a target year", () => {
    const solar = findSolarDateForLunarDate(2026, 6, 9, false);
    expect(solar).not.toBeNull();
    expect(toYmd(solar ?? new Date(NaN))).toBe("2026-07-22");
  });

  it("matches the requested lunar year for late-year lunar dates", () => {
    const solar = findSolarDateForLunarDate(2026, 12, 15, false);
    expect(solar).not.toBeNull();
    expect((solar ?? new Date(NaN)).getFullYear()).toBe(2027);
    const lunar = getLunarDateInfo(solar ?? new Date(NaN));
    expect(lunar?.year).toBe(2026);
    expect(lunar?.month).toBe(12);
    expect(lunar?.day).toBe(15);
  });

  it("shows lunar labels only on the 1st and 15th lunar days", () => {
    expect(formatLunarMonthDayLabel(new Date(2026, 5, 15))).toBe("음 5.1");
    expect(formatLunarMonthDayLabel(new Date(2026, 5, 29))).toBe("음 5.15");
    expect(formatLunarMonthDayLabel(new Date(2026, 6, 22))).toBeNull();
  });

  it("expands yearly lunar anniversaries into solar occurrences", () => {
    const base = findSolarDateForLunarDate(1970, 6, 9, false);
    expect(base).not.toBeNull();
    const baseStart = startOfDay(base ?? new Date(NaN));
    const now = new Date(2026, 0, 1).toISOString();
    const event: CalendarEvent = {
      id: "event-1",
      widgetId: "widget-1",
      dashboardId: "dashboard-1",
      title: "Father birthday",
      startAt: baseStart.toISOString(),
      endAt: undefined,
      allDay: true,
      color: "#3b82f6",
      recurrence: {
        type: "yearly",
        calendar: "lunar",
        lunarYear: 1970,
        lunarMonth: 6,
        lunarDay: 9,
      },
      location: undefined,
      description: undefined,
      createdAt: now,
      updatedAt: now,
    };

    const expanded = expandCalendarEvents(
      [event],
      new Date(2026, 6, 1),
      new Date(2026, 6, 31)
    );

    expect(expanded.length).toBe(1);
    expect(toYmd(new Date(expanded[0]?.startAt ?? ""))).toBe("2026-07-22");
  });
});
