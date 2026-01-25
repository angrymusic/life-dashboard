import type { YMD } from "@/shared/db/schema";

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});

export function formatShortDate(ymd: YMD) {
  const [yyyy, mm, dd] = ymd.split("-");
  if (!yyyy || !mm || !dd) return ymd;
  return `${mm}.${dd}`;
}

export function formatLongDate(ymd: YMD) {
  const [yyyy, mm, dd] = ymd.split("-");
  if (!yyyy || !mm || !dd) return ymd;
  return `${yyyy}.${mm}.${dd}`;
}

export function formatValue(value: number, unit?: string) {
  const formatted = numberFormatter.format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}
