import type { CalendarRecurrenceCycleItem } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { COLOR_PRESETS } from "@/feature/widgets/Calendar/libs/calendarUtils";
import type { ReactNode } from "react";

export type RecurrenceType = "none" | "weekly" | "cycle" | "yearly";
export type ScheduleMode = "single" | "range" | "recurrence" | "anniversary";
export type AnniversaryCalendar = "solar" | "lunar";
type TranslateFn = (ko: string, en: string) => string;

export const FIELD_INPUT_CLASS =
  "min-w-0 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-base outline-none focus:ring-1 focus:ring-blue-500";

const CHIP_BUTTON_CLASS =
  "rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition";
const CHIP_BUTTON_ACTIVE_CLASS = "bg-primary/10 text-primary";
const CHIP_BUTTON_INACTIVE_CLASS =
  "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/40";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedOptionRowProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

type TwoColumnLabelsProps = {
  left: ReactNode;
  right: ReactNode;
  rightAlign?: boolean;
};

type TwoColumnFieldsProps = {
  left: ReactNode;
  right: ReactNode;
};

type SingleScheduleSectionProps = {
  draftStartDate: string;
  draftTime: string;
  setRangeStartDate: (value: string) => void;
  setDraftTime: (value: string) => void;
  t: TranslateFn;
};

type RangeScheduleSectionProps = {
  draftStartDate: string;
  draftEndDate: string;
  draftStartTime: string;
  draftEndTime: string;
  setRangeStartDate: (value: string) => void;
  setRangeEndDate: (value: string) => void;
  setDraftStartTime: (value: string) => void;
  setDraftEndTime: (value: string) => void;
  t: TranslateFn;
};

type RecurrenceScheduleSectionProps = {
  recurrenceType: RecurrenceType;
  setRecurrenceType: (value: RecurrenceType) => void;
  recurrenceUntil: string;
  setRecurrenceUntil: (value: string) => void;
  draftStartDate: string;
  draftTime: string;
  setRangeStartDate: (value: string) => void;
  setDraftTime: (value: string) => void;
  weekDays: string[];
  weeklyDays: number[];
  toggleWeeklyDay: (index: number) => void;
  cyclePattern: CalendarRecurrenceCycleItem[];
  draftColor: string;
  addCyclePatternItem: () => void;
  updateCyclePatternItem: (
    index: number,
    patch: Partial<CalendarRecurrenceCycleItem>
  ) => void;
  removeCyclePatternItem: (index: number) => void;
  isCyclePatternValid: boolean;
  t: TranslateFn;
};

type AnniversaryScheduleSectionProps = {
  anniversaryCalendar: AnniversaryCalendar;
  setAnniversaryCalendar: (value: AnniversaryCalendar) => void;
  draftStartDate: string;
  setRangeStartDate: (value: string) => void;
  draftLunarLeapMonth: boolean;
  setDraftLunarLeapMonth: (value: boolean) => void;
  lunarPreviewYmd: string;
  t: TranslateFn;
};

function TwoColumnLabels({ left, right, rightAlign = false }: TwoColumnLabelsProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="min-w-0 flex-1">{left}</span>
      <span className={cn("min-w-0 flex-1", rightAlign ? "text-right" : "")}>{right}</span>
    </div>
  );
}

function TwoColumnFields({ left, right }: TwoColumnFieldsProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="max-w-full flex-1">{left}</div>
      <div className="max-w-full flex-1">{right}</div>
    </div>
  );
}

export function SegmentedOptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedOptionRowProps<T>) {
  return (
    <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-gray-200 p-1 dark:border-gray-700">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                CHIP_BUTTON_CLASS,
                isActive ? CHIP_BUTTON_ACTIVE_CLASS : CHIP_BUTTON_INACTIVE_CLASS
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SingleScheduleSection({
  draftStartDate,
  draftTime,
  setRangeStartDate,
  setDraftTime,
  t,
}: SingleScheduleSectionProps) {
  return (
    <>
      <TwoColumnLabels left={t("시작 날짜", "Start date")} right={t("시작 시간", "Start time")} />
      <TwoColumnFields
        left={
          <input
            type="date"
            aria-label="Start date"
            className={FIELD_INPUT_CLASS}
            value={draftStartDate}
            onChange={(event) => setRangeStartDate(event.target.value)}
          />
        }
        right={
          <input
            type="time"
            aria-label="Start time"
            className={FIELD_INPUT_CLASS}
            value={draftTime}
            onChange={(event) => setDraftTime(event.target.value)}
          />
        }
      />
    </>
  );
}

export function RangeScheduleSection({
  draftStartDate,
  draftEndDate,
  draftStartTime,
  draftEndTime,
  setRangeStartDate,
  setRangeEndDate,
  setDraftStartTime,
  setDraftEndTime,
  t,
}: RangeScheduleSectionProps) {
  return (
    <>
      <TwoColumnLabels left={t("시작 날짜", "Start date")} right={t("끝 날짜", "End date")} />
      <TwoColumnFields
        left={
          <input
            type="date"
            aria-label="Start date"
            className={FIELD_INPUT_CLASS}
            value={draftStartDate}
            max={draftEndDate}
            onChange={(event) => setRangeStartDate(event.target.value)}
          />
        }
        right={
          <input
            type="date"
            aria-label="End date"
            className={FIELD_INPUT_CLASS}
            value={draftEndDate}
            min={draftStartDate}
            onChange={(event) => setRangeEndDate(event.target.value)}
          />
        }
      />
      <TwoColumnLabels left={t("시작 시간", "Start time")} right={t("끝 시간", "End time")} />
      <TwoColumnFields
        left={
          <input
            type="time"
            aria-label="Start time"
            className={FIELD_INPUT_CLASS}
            value={draftStartTime}
            onChange={(event) => setDraftStartTime(event.target.value)}
          />
        }
        right={
          <input
            type="time"
            aria-label="End time"
            className={FIELD_INPUT_CLASS}
            value={draftEndTime}
            onChange={(event) => setDraftEndTime(event.target.value)}
          />
        }
      />
    </>
  );
}

export function RecurrenceScheduleSection({
  recurrenceType,
  setRecurrenceType,
  recurrenceUntil,
  setRecurrenceUntil,
  draftStartDate,
  draftTime,
  setRangeStartDate,
  setDraftTime,
  weekDays,
  weeklyDays,
  toggleWeeklyDay,
  cyclePattern,
  draftColor,
  addCyclePatternItem,
  updateCyclePatternItem,
  removeCyclePatternItem,
  isCyclePatternValid,
  t,
}: RecurrenceScheduleSectionProps) {
  const recurrenceValue = recurrenceType === "cycle" ? "cycle" : "weekly";
  const isWeekly = recurrenceValue === "weekly";
  const isCycle = recurrenceValue === "cycle";

  return (
    <>
      {isWeekly ? (
        <>
          <TwoColumnLabels left={t("기준 날짜", "Base date")} right={t("시작 시간", "Start time")} />
          <TwoColumnFields
            left={
              <input
                type="date"
                aria-label="Base date"
                className={FIELD_INPUT_CLASS}
                value={draftStartDate}
                onChange={(event) => setRangeStartDate(event.target.value)}
              />
            }
            right={
              <input
                type="time"
                aria-label="Start time"
                className={FIELD_INPUT_CLASS}
                value={draftTime}
                onChange={(event) => setDraftTime(event.target.value)}
              />
            }
          />
        </>
      ) : (
        <>
          <div className="text-xs text-gray-500">
            <span>{t("기준 날짜", "Base date")}</span>
          </div>
          <div>
            <input
              type="date"
              aria-label="Base date"
              className={FIELD_INPUT_CLASS}
              value={draftStartDate}
              onChange={(event) => setRangeStartDate(event.target.value)}
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{t("반복 유형", "Recurrence type")}</span>
        <select
          aria-label="Recurrence type"
          className={cn(FIELD_INPUT_CLASS, "sm:w-auto")}
          value={recurrenceValue}
          onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}
        >
          <option value="weekly">{t("요일 반복", "Weekly")}</option>
          <option value="cycle">{t("교대 패턴", "Shift cycle")}</option>
        </select>
      </div>

      <TwoColumnLabels left={t("반복 종료", "Repeat until")} right={t("선택", "Choose")} rightAlign />
      <TwoColumnFields
        left={
          <input
            type="date"
            aria-label="Recurrence end date"
            className={FIELD_INPUT_CLASS}
            value={recurrenceUntil}
            min={draftStartDate}
            onChange={(event) => setRecurrenceUntil(event.target.value)}
          />
        }
        right={
          <button
            type="button"
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40"
            onClick={() => setRecurrenceUntil("")}
          >
            {t("무기한", "No end date")}
          </button>
        }
      />

      {isWeekly ? (
        <>
          <div className="text-xs text-gray-500">{t("요일 선택", "Select weekdays")}</div>
          <div className="flex flex-wrap gap-1">
            {weekDays.map((day, index) => {
              const isActive = weeklyDays.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-xs font-medium transition",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40"
                  )}
                  onClick={() => toggleWeeklyDay(index)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {isCycle ? (
        <>
          <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("교대 패턴", "Shift cycle")}</span>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40"
              onClick={addCyclePatternItem}
            >
              {t("+ 항목 추가", "+ Add item")}
            </button>
          </div>
          <div className="space-y-2">
            {cyclePattern.map((item, index) => (
              <div
                key={`cycle-${index}`}
                className="flex flex-col gap-2 rounded-md border border-gray-200/70 p-2 dark:border-gray-700 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
                  <label className="flex items-center gap-1 text-[10px] text-gray-400">
                    <input
                      type="checkbox"
                      checked={Boolean(item.isGap)}
                      onChange={() =>
                        updateCyclePatternItem(index, {
                          isGap: !item.isGap,
                        })
                      }
                    />
                    {t("공백", "Gap")}
                  </label>
                  <input
                    aria-label={`Pattern label ${index + 1}`}
                    className={cn(
                      FIELD_INPUT_CLASS,
                      item.isGap ? "text-gray-400 placeholder:text-gray-400" : ""
                    )}
                    placeholder={
                      item.isGap
                        ? t("공백", "Gap")
                        : t(`패턴 ${index + 1}`, `Pattern ${index + 1}`)
                    }
                    value={item.isGap ? "" : item.label}
                    onChange={(event) =>
                      updateCyclePatternItem(index, {
                        label: event.target.value,
                      })
                    }
                    disabled={Boolean(item.isGap)}
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  aria-label={`Pattern days ${index + 1}`}
                  className={cn(FIELD_INPUT_CLASS, "sm:w-24")}
                  value={item.days ?? 1}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    updateCyclePatternItem(index, {
                      days: Number.isFinite(next) ? next : 1,
                    });
                  }}
                />
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={`${index}-${color}`}
                        type="button"
                        aria-label={`Set pattern color ${color}`}
                        className={cn(
                          "h-5 w-5 rounded-full border border-gray-200",
                          (item.color ?? draftColor) === color ? "ring-2 ring-gray-900/50" : "",
                          item.isGap ? "opacity-40" : ""
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          if (item.isGap) return;
                          updateCyclePatternItem(index, { color });
                        }}
                        disabled={Boolean(item.isGap)}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input
                      type="color"
                      aria-label={`Pattern custom color ${index + 1}`}
                      className={cn(
                        "h-6 w-7 rounded border border-gray-200 bg-transparent p-0",
                        item.isGap ? "opacity-40" : ""
                      )}
                      value={item.color ?? draftColor}
                      onChange={(event) => {
                        if (item.isGap) return;
                        updateCyclePatternItem(index, {
                          color: event.target.value || draftColor,
                        });
                      }}
                      disabled={Boolean(item.isGap)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="self-start text-xs font-medium text-gray-400 transition hover:text-red-500 sm:self-auto"
                  onClick={() => removeCyclePatternItem(index)}
                >
                  {t("삭제", "Delete")}
                </button>
              </div>
            ))}
          </div>
          {!isCyclePatternValid ? (
            <div className="text-xs text-rose-500">
              {t("일수는 1 이상이어야 합니다.", "Days must be 1 or greater.")}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function AnniversaryScheduleSection({
  anniversaryCalendar,
  setAnniversaryCalendar,
  draftStartDate,
  setRangeStartDate,
  draftLunarLeapMonth,
  setDraftLunarLeapMonth,
  lunarPreviewYmd,
  t,
}: AnniversaryScheduleSectionProps) {
  const isLunar = anniversaryCalendar === "lunar";
  const anniversaryOptions: { value: AnniversaryCalendar; label: string }[] = [
    { value: "solar", label: t("양력", "Solar") },
    { value: "lunar", label: t("음력", "Lunar") },
  ];

  return (
    <>
      <SegmentedOptionRow
        label={t("기준 달력", "Calendar basis")}
        options={anniversaryOptions}
        value={anniversaryCalendar}
        onChange={setAnniversaryCalendar}
      />

      <div className="text-xs text-gray-500">
        <span>{t("기념일 날짜", "Anniversary date")}</span>
      </div>
      <div>
        <input
          type="date"
          aria-label="Anniversary date"
          className={FIELD_INPUT_CLASS}
          value={draftStartDate}
          onChange={(event) => setRangeStartDate(event.target.value)}
        />
      </div>

      {isLunar ? (
        <>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={draftLunarLeapMonth}
              onChange={(event) => setDraftLunarLeapMonth(event.target.checked)}
            />
            {t("윤달 기준", "Use leap month")}
          </label>
          {lunarPreviewYmd ? (
            <div className="text-xs text-gray-500">
              {t(`양력 변환: ${lunarPreviewYmd}`, `Solar date: ${lunarPreviewYmd}`)}
            </div>
          ) : (
            <div className="text-xs text-rose-500">
              {t(
                "입력한 음력 날짜를 양력으로 변환할 수 없어요.",
                "Unable to convert this lunar date to solar."
              )}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
