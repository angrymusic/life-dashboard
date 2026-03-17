import type { YMD } from "@/shared/db/schema";

export type SummaryWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isSummaryWeekday(value: unknown): value is SummaryWeekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

export function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

export function parseYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || toYmd(date) !== ymd) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function shiftYmd(ymd: string, deltaDays: number) {
  const date = parseYmd(ymd);
  if (!date) return null;
  date.setDate(date.getDate() + deltaDays);
  return toYmd(date);
}

export function getSummaryWindow(
  summaryWeekday: SummaryWeekday,
  baseDate = new Date()
) {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const delta = (today.getDay() - summaryWeekday + 7) % 7;
  const anchor = new Date(today);
  anchor.setDate(today.getDate() - delta);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - 7);

  return {
    windowStartYmd: toYmd(start),
    windowEndYmd: toYmd(anchor),
    windowStartAt: start.toISOString(),
    windowEndAt: anchor.toISOString(),
  };
}
