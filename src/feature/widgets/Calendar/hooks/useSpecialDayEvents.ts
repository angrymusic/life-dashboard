import { useEffect, useMemo, useRef, useState } from "react";
import type { Id, YMD } from "@/shared/db/schema";
import {
  startOfDay,
  toDateFromYmd,
} from "@/feature/widgets/Calendar/libs/calendarUtils";
import type { CalendarEventInstance } from "@/feature/widgets/Calendar/libs/calendarUtils";

type SpecialDayKind = "holiday" | "anniversary";

type SpecialDayItem = {
  ymd: string;
  name: string;
  kind: SpecialDayKind;
  seq?: string;
  isHoliday?: boolean;
};

type SpecialDayResponse = {
  items?: SpecialDayItem[];
};

type MonthEntry = {
  key: string;
  year: number;
  month: number;
};

type UseSpecialDayEventsOptions = {
  widgetId: Id;
  dashboardId?: Id;
  rangeStart: Date;
  rangeEnd: Date;
  enabled?: boolean;
};

const HOLIDAY_COLOR = "#ef4444";
const ANNIVERSARY_COLOR = "#f97316";

function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function normalizeYmd(value: string): YMD | null {
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed as YMD;
  }
  return null;
}

function getMonthEntries(rangeStart: Date, rangeEnd: Date) {
  const entries: MonthEntry[] = [];
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return entries;
  }
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    entries.push({ key, year, month });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return entries;
}

function buildEventId(ymd: YMD, item: SpecialDayItem) {
  const base = `${ymd}:${item.kind}:${item.seq ?? hashString(item.name)}`;
  return `special:${base}`;
}

function buildSpecialEvent(
  item: SpecialDayItem,
  widgetId: Id,
  dashboardId: Id
): CalendarEventInstance | null {
  const normalizedYmd = normalizeYmd(item.ymd);
  if (!normalizedYmd) return null;
  const date = toDateFromYmd(normalizedYmd);
  if (Number.isNaN(date.getTime())) return null;
  const startAt = startOfDay(date).toISOString();
  const color = item.kind === "holiday" ? HOLIDAY_COLOR : ANNIVERSARY_COLOR;
  return {
    id: buildEventId(normalizedYmd, item),
    widgetId,
    dashboardId,
    title: item.name,
    startAt,
    endAt: undefined,
    allDay: true,
    location: undefined,
    description: undefined,
    color,
    recurrence: undefined,
    createdAt: startAt,
    updatedAt: startAt,
    readOnly: true,
    source: item.kind,
  };
}

async function fetchSpecialDays(year: number, month: number) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const response = await fetch(`/api/special-days?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch special days.");
  }
  const payload = (await response.json()) as SpecialDayResponse;
  return Array.isArray(payload.items) ? payload.items : [];
}

export function useSpecialDayEvents({
  widgetId,
  dashboardId,
  rangeStart,
  rangeEnd,
  enabled = true,
}: UseSpecialDayEventsOptions) {
  const cacheRef = useRef(new Map<string, CalendarEventInstance[]>());
  const pendingRef = useRef(new Set<string>());
  const [, bumpCacheVersion] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const monthEntries = useMemo(
    () => getMonthEntries(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const events = (() => {
    if (!dashboardId) return [];
    const collected: CalendarEventInstance[] = [];
    for (const entry of monthEntries) {
      const cached = cacheRef.current.get(entry.key);
      if (cached) {
        collected.push(...cached);
      }
    }
    return collected;
  })();

  useEffect(() => {
    if (!enabled) return;
    if (!dashboardId) return;

    const missing = monthEntries.filter(
      (entry) =>
        !cacheRef.current.has(entry.key) &&
        !pendingRef.current.has(entry.key)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const results = await Promise.all(
          missing.map(async (entry) => {
            pendingRef.current.add(entry.key);
            try {
              const items = await fetchSpecialDays(entry.year, entry.month);
              return { entry, items };
            } finally {
              pendingRef.current.delete(entry.key);
            }
          })
        );

        if (cancelled) return;

        let didUpdate = false;
        for (const result of results) {
          const built = result.items
            .map((item) => buildSpecialEvent(item, widgetId, dashboardId))
            .filter((item): item is CalendarEventInstance => Boolean(item));
          cacheRef.current.set(result.entry.key, built);
          didUpdate = true;
        }
        if (didUpdate) {
          bumpCacheVersion((version) => version + 1);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error("fetch-failed"));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, dashboardId, widgetId, monthEntries]);

  return { events, isLoading, error };
}
