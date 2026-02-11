import type { YMD } from "@/shared/db/schema";

function toDate(ymd: YMD) {
  const [yyyy, mm, dd] = ymd.split("-");
  if (!yyyy || !mm || !dd) return null;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatShortDate(ymd: YMD, locale: string) {
  const date = toDate(ymd);
  if (!date) return ymd;
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatLongDate(ymd: YMD, locale: string) {
  const date = toDate(ymd);
  if (!date) return ymd;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatValue(value: number, locale: string, unit?: string) {
  const numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
  const formatted = numberFormatter.format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}
