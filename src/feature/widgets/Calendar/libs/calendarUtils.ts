import type { CalendarEvent, YMD } from "@/shared/db/schema";

export const DEFAULT_EVENT_COLOR = "#3b82f6";
export const COLOR_PRESETS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
  "#facc15",
  "#14b8a6",
];
export const MAX_EVENT_ROWS = 4;

export function getWeekDayLabels(locale: string) {
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(sunday, index);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
    }).format(date);
  });
}

const DEFAULT_ALL_DAY_HOUR = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarEventInstance = CalendarEvent & {
  occurrenceKey?: string;
  readOnly?: boolean;
  source?: "holiday" | "anniversary" | "local";
};

export type CalendarEventSegment = {
  event: CalendarEventInstance;
  isStart: boolean;
  isEnd: boolean;
};

export type CalendarDay = {
  date: Date;
  ymd: YMD;
  inMonth: boolean;
  segments: Array<CalendarEventSegment | null>;
  overflow: number;
};

export function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toDateFromYmd(ymd: YMD) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

export function shiftMonth(date: Date, delta: number) {
  const year = date.getFullYear();
  const month = date.getMonth() + delta;
  const day = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return new Date(year, month, nextDay);
}

export function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export function shiftYmd(ymd: YMD, delta: number): YMD {
  const date = toDateFromYmd(ymd);
  if (Number.isNaN(date.getTime())) return ymd;
  date.setDate(date.getDate() + delta);
  return toYmd(date);
}

function parseTime(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

export function buildStartAt(date: Date, time: string) {
  const parsed = parseTime(time);
  if (!parsed) {
    return {
      startAt: new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        DEFAULT_ALL_DAY_HOUR,
        0,
        0
      ),
      allDay: true,
    };
  }

  return {
    startAt: new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parsed.hours,
      parsed.minutes,
      0
    ),
    allDay: false,
  };
}

export function getCalendarViewRange(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const remaining = totalCells - (startWeekday + daysInMonth);
  const start = new Date(year, month, 1 - startWeekday);
  const end = new Date(year, month, daysInMonth + remaining);
  return { start, end };
}

export function buildCalendarDays(
  viewDate: Date,
  eventsByDate: Map<YMD, CalendarEventInstance[]>
): CalendarDay[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const remaining = totalCells - (startWeekday + daysInMonth);
  const { start: viewStartDate, end: viewEndDate } =
    getCalendarViewRange(viewDate);
  const viewStartMs = startOfDay(viewStartDate).getTime();
  const viewEndMs = startOfDay(viewEndDate).getTime();

  const days: CalendarDay[] = [];

  const isDateInView = (date: Date) => {
    const time = date.getTime();
    return !Number.isNaN(time) && time >= viewStartMs && time <= viewEndMs;
  };

  const getEventKey = (event: CalendarEventInstance) =>
    event.occurrenceKey ?? event.id;

  const buildSegment = (
    ymd: YMD,
    event: CalendarEventInstance,
    columnIndex: number
  ): CalendarEventSegment => {
    const prevYmd = shiftYmd(ymd, -1);
    const nextYmd = shiftYmd(ymd, 1);
    const prevDate = toDateFromYmd(prevYmd);
    const nextDate = toDateFromYmd(nextYmd);
    const prevInView = isDateInView(prevDate);
    const nextInView = isDateInView(nextDate);
    const eventKey = getEventKey(event);

    const prevHas = prevInView
      ? (eventsByDate.get(prevYmd) ?? []).some(
          (eventItem) => getEventKey(eventItem) === eventKey
        )
      : false;
    const nextHas = nextInView
      ? (eventsByDate.get(nextYmd) ?? []).some(
          (eventItem) => getEventKey(eventItem) === eventKey
        )
      : false;

    const isWeekStart = columnIndex === 0;
    const isWeekEnd = columnIndex === 6;

    return {
      event,
      isStart: isWeekStart ? true : !prevHas,
      isEnd: isWeekEnd ? true : !nextHas,
    };
  };

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const date = new Date(year, month - 1, day);
    const ymd = toYmd(date);
    days.push({
      date,
      ymd,
      inMonth: false,
      segments: Array.from({ length: MAX_EVENT_ROWS }, () => null),
      overflow: 0,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const ymd = toYmd(date);
    days.push({
      date,
      ymd,
      inMonth: true,
      segments: Array.from({ length: MAX_EVENT_ROWS }, () => null),
      overflow: 0,
    });
  }

  for (let day = 1; day <= remaining; day += 1) {
    const date = new Date(year, month + 1, day);
    const ymd = toYmd(date);
    days.push({
      date,
      ymd,
      inMonth: false,
      segments: Array.from({ length: MAX_EVENT_ROWS }, () => null),
      overflow: 0,
    });
  }

  const totalWeeks = Math.ceil(days.length / 7);
  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const weekStart = weekIndex * 7;
    const weekDays = days.slice(weekStart, weekStart + 7);
    const weekEvents = new Map<
      string,
      { event: CalendarEventInstance; days: number[]; startTs: number }
    >();

    weekDays.forEach((day, dayIndex) => {
      const events = eventsByDate.get(day.ymd) ?? [];
      for (const event of events) {
        const eventKey = getEventKey(event);
        const existing = weekEvents.get(eventKey);
        if (existing) {
          if (!existing.days.includes(dayIndex)) {
            existing.days.push(dayIndex);
          }
          continue;
        }
        const startTs = new Date(event.startAt).getTime();
        weekEvents.set(eventKey, {
          event,
          days: [dayIndex],
          startTs: Number.isNaN(startTs) ? Number.MAX_SAFE_INTEGER : startTs,
        });
      }
    });

    const sortedEvents = Array.from(weekEvents.values()).sort((a, b) => {
      const aMulti = a.days.length > 1;
      const bMulti = b.days.length > 1;
      if (aMulti !== bMulti) return aMulti ? -1 : 1;
      if (a.startTs !== b.startTs) return a.startTs - b.startTs;
      return String(getEventKey(a.event)).localeCompare(String(getEventKey(b.event)));
    });

    const rowUsage = Array.from({ length: MAX_EVENT_ROWS }, () =>
      Array.from({ length: 7 }, () => false)
    );
    const overflowCount = Array.from({ length: 7 }, () => 0);

    for (const item of sortedEvents) {
      let assignedRow = -1;
      for (let rowIndex = 0; rowIndex < MAX_EVENT_ROWS; rowIndex += 1) {
        const canPlace = item.days.every((dayIndex) => !rowUsage[rowIndex][dayIndex]);
        if (canPlace) {
          assignedRow = rowIndex;
          break;
        }
      }

      if (assignedRow < 0) {
        for (const dayIndex of item.days) {
          overflowCount[dayIndex] += 1;
        }
        continue;
      }

      for (const dayIndex of item.days) {
        rowUsage[assignedRow][dayIndex] = true;
        const day = weekDays[dayIndex];
        day.segments[assignedRow] = buildSegment(day.ymd, item.event, dayIndex);
      }
    }

    weekDays.forEach((day, dayIndex) => {
      day.overflow = overflowCount[dayIndex];
    });
  }

  return days;
}

function daysBetween(start: Date, end: Date) {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  return Math.floor((endDay.getTime() - startDay.getTime()) / DAY_MS);
}

function getWeekStart(date: Date) {
  return startOfDay(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
  );
}

function buildDateForYear(base: Date, year: number) {
  const month = base.getMonth();
  const day = base.getDate();
  const hours = base.getHours();
  const minutes = base.getMinutes();
  const seconds = base.getSeconds();
  const ms = base.getMilliseconds();
  const candidate = new Date(year, month, day, hours, minutes, seconds, ms);
  if (candidate.getMonth() !== month) {
    const lastDay = new Date(year, month + 1, 0);
    return new Date(
      year,
      month,
      lastDay.getDate(),
      hours,
      minutes,
      seconds,
      ms
    );
  }
  return candidate;
}

function occursInRange(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date) {
  const endDate = end ?? start;
  return (
    start.getTime() <= rangeEnd.getTime() &&
    endDate.getTime() >= rangeStart.getTime()
  );
}

export function expandCalendarEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEventInstance[] {
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = endOfDay(rangeEnd);
  const results: CalendarEventInstance[] = [];

  for (const event of events) {
    const baseStart = new Date(event.startAt);
    if (Number.isNaN(baseStart.getTime())) continue;
    const baseEndCandidate = event.endAt ? new Date(event.endAt) : null;
    const baseEnd =
      baseEndCandidate && !Number.isNaN(baseEndCandidate.getTime())
        ? baseEndCandidate
        : null;

    if (!event.recurrence) {
      if (!occursInRange(baseStart, baseEnd, rangeStartDay, rangeEndDay)) {
        continue;
      }
      results.push(event);
      continue;
    }

    if (event.recurrence.type === "weekly") {
      const daysOfWeek = (event.recurrence.daysOfWeek ?? []).filter(
        (day) => day >= 0 && day <= 6
      );
      if (daysOfWeek.length === 0) continue;
      const intervalWeeks = Math.max(1, event.recurrence.intervalWeeks ?? 1);
      let untilDate = event.recurrence.until
        ? endOfDay(toDateFromYmd(event.recurrence.until))
        : null;
      if (untilDate && Number.isNaN(untilDate.getTime())) {
        untilDate = null;
      }
      const baseStartDay = startOfDay(baseStart);
      const baseEndDay = baseEnd ? startOfDay(baseEnd) : baseStartDay;
      const spanDays = Math.max(0, daysBetween(baseStartDay, baseEndDay));
      const cursorStart = addDays(rangeStartDay, -spanDays);
      let cursor =
        cursorStart.getTime() > baseStartDay.getTime()
          ? cursorStart
          : baseStartDay;

      while (cursor.getTime() <= rangeEndDay.getTime()) {
        if (untilDate && cursor.getTime() > untilDate.getTime()) break;
        if (daysOfWeek.includes(cursor.getDay())) {
          const weekDiff = Math.floor(
            (getWeekStart(cursor).getTime() - getWeekStart(baseStartDay).getTime()) /
              (DAY_MS * 7)
          );
          if (weekDiff % intervalWeeks === 0) {
            const isAllDay = Boolean(event.allDay);
            let occurrenceStart: Date;
            let occurrenceEnd: Date | undefined;

            if (isAllDay) {
              occurrenceStart = startOfDay(cursor);
              if (baseEnd) {
                occurrenceEnd = endOfDay(addDays(occurrenceStart, spanDays));
              }
            } else {
              occurrenceStart = new Date(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate(),
                baseStart.getHours(),
                baseStart.getMinutes(),
                baseStart.getSeconds(),
                baseStart.getMilliseconds()
              );
              if (baseEnd) {
                const durationMs = baseEnd.getTime() - baseStart.getTime();
                occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
              }
            }

            if (
              occursInRange(
                occurrenceStart,
                occurrenceEnd ?? null,
                rangeStartDay,
                rangeEndDay
              )
            ) {
              results.push({
                ...event,
                startAt: occurrenceStart.toISOString(),
                endAt: occurrenceEnd ? occurrenceEnd.toISOString() : undefined,
                allDay: isAllDay,
                occurrenceKey: `${event.id}:${occurrenceStart.toISOString()}`,
              });
            }
          }
        }
        cursor = addDays(cursor, 1);
      }
      continue;
    }

    if (event.recurrence.type === "cycle") {
      const pattern = event.recurrence.pattern ?? [];
      if (pattern.length === 0) continue;
      const normalizedPattern = pattern.map((item) => ({
        ...item,
        days: Math.max(1, Math.floor(item.days ?? 1)),
      }));
      const totalDays = normalizedPattern.reduce(
        (sum, item) => sum + (item.days ?? 1),
        0
      );
      if (totalDays <= 0) continue;
      let untilDate = event.recurrence.until
        ? endOfDay(toDateFromYmd(event.recurrence.until))
        : null;
      if (untilDate && Number.isNaN(untilDate.getTime())) {
        untilDate = null;
      }
      const anchorDay = startOfDay(baseStart);
      const cursorStart = addDays(rangeStartDay, -1);
      let cursor =
        cursorStart.getTime() > anchorDay.getTime() ? cursorStart : anchorDay;

      while (cursor.getTime() <= rangeEndDay.getTime()) {
        if (untilDate && cursor.getTime() > untilDate.getTime()) break;
        const dayIndex = daysBetween(anchorDay, cursor);
        if (dayIndex < 0) {
          cursor = addDays(cursor, 1);
          continue;
        }
        let remainder = dayIndex % totalDays;
        const patternItem =
          normalizedPattern.find((item) => {
            const span = item.days ?? 1;
            if (remainder < span) return true;
            remainder -= span;
            return false;
          }) ?? normalizedPattern[normalizedPattern.length - 1];
        if (!patternItem) {
          cursor = addDays(cursor, 1);
          continue;
        }
        if (patternItem.isGap) {
          cursor = addDays(cursor, 1);
          continue;
        }

        const occurrenceStart = startOfDay(cursor);
        const occurrenceAllDay = true;

        if (
          occursInRange(
            occurrenceStart,
            null,
            rangeStartDay,
            rangeEndDay
          )
        ) {
          results.push({
            ...event,
            title: patternItem.label.trim() || event.title,
            color: patternItem.color ?? event.color,
            startAt: occurrenceStart.toISOString(),
            endAt: undefined,
            allDay: occurrenceAllDay,
            occurrenceKey: `${event.id}:${occurrenceStart.toISOString()}`,
          });
        }

        cursor = addDays(cursor, 1);
      }
    }

    if (event.recurrence.type === "yearly") {
      const intervalYears = Math.max(1, event.recurrence.intervalYears ?? 1);
      let untilDate = event.recurrence.until
        ? endOfDay(toDateFromYmd(event.recurrence.until))
        : null;
      if (untilDate && Number.isNaN(untilDate.getTime())) {
        untilDate = null;
      }

      const baseYear = baseStart.getFullYear();
      const rangeStartYear = rangeStartDay.getFullYear() - 1;
      const rangeEndYear = rangeEndDay.getFullYear() + 1;
      const durationMs = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0;

      for (let year = rangeStartYear; year <= rangeEndYear; year += 1) {
        if (year < baseYear) continue;
        if ((year - baseYear) % intervalYears !== 0) continue;
        const rawStart = buildDateForYear(baseStart, year);
        const occurrenceStart = event.allDay ? startOfDay(rawStart) : rawStart;
        if (untilDate && occurrenceStart.getTime() > untilDate.getTime()) break;
        const occurrenceEnd =
          baseEnd && durationMs !== 0
            ? new Date(occurrenceStart.getTime() + durationMs)
            : undefined;

        if (
          occursInRange(
            occurrenceStart,
            occurrenceEnd ?? null,
            rangeStartDay,
            rangeEndDay
          )
        ) {
          results.push({
            ...event,
            startAt: occurrenceStart.toISOString(),
            endAt: occurrenceEnd ? occurrenceEnd.toISOString() : undefined,
            allDay: Boolean(event.allDay),
            occurrenceKey: `${event.id}:${occurrenceStart.toISOString()}`,
          });
        }
      }
    }
  }

  return results;
}

export function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function formatMonthDay(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatYearMonthDay(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatMeridiemTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTimeInput(date: Date) {
  return formatTime(date);
}

export function parseTimeInput(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

export function formatEventTime(event: CalendarEvent, locale: string) {
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return "";
  const end = event.endAt ? new Date(event.endAt) : null;
  const allDayLabel = locale.startsWith("ko") ? "종일" : "All day";

  if (event.allDay) {
    if (end && !Number.isNaN(end.getTime()) && !isSameDay(start, end)) {
      return `${formatYearMonthDay(start, locale)} ~ ${formatYearMonthDay(end, locale)}`;
    }
    return `${formatYearMonthDay(start, locale)} ${allDayLabel}`;
  }

  if (end && !Number.isNaN(end.getTime())) {
    if (isSameDay(start, end)) {
      return `${formatYearMonthDay(start, locale)} ${formatMeridiemTime(
        start,
        locale
      )} - ${formatMeridiemTime(end, locale)}`;
    }
    return `${formatYearMonthDay(start, locale)} ${formatMeridiemTime(
      start,
      locale
    )} ~ ${formatYearMonthDay(end, locale)} ${formatMeridiemTime(end, locale)}`;
  }

  return `${formatYearMonthDay(start, locale)} ${formatMeridiemTime(start, locale)}`;
}

export function normalizeColor(value?: string) {
  return value?.trim() || DEFAULT_EVENT_COLOR;
}

function parseHexColor(value: string) {
  const hex = value.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  return null;
}

export function getContrastColor(value: string) {
  const parsed = parseHexColor(value);
  if (!parsed) return "#ffffff";
  const luminance = 0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b;
  return luminance > 160 ? "#0f172a" : "#ffffff";
}
