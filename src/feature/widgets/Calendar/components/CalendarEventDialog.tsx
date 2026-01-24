import type { CalendarRecurrenceCycleItem, Id } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  COLOR_PRESETS,
  DEFAULT_EVENT_COLOR,
  WEEK_DAYS,
} from "@/feature/widgets/Calendar/libs/calendarUtils";

type RecurrenceType = "none" | "weekly" | "cycle" | "yearly";
type ScheduleMode = "single" | "range" | "recurrence" | "anniversary";

type CalendarEventDialogProps = {
  open: boolean;
  editingEventId: Id | null;
  canCreate: boolean;
  draftTitle: string;
  draftTime: string;
  draftStartTime: string;
  draftEndTime: string;
  draftStartDate: string;
  draftEndDate: string;
  draftColor: string;
  isRange: boolean;
  recurrenceType: RecurrenceType;
  recurrenceUntil: string;
  weeklyDays: number[];
  cyclePattern: CalendarRecurrenceCycleItem[];
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  setDraftTitle: (value: string) => void;
  setDraftTime: (value: string) => void;
  setDraftStartTime: (value: string) => void;
  setDraftEndTime: (value: string) => void;
  setRangeStartDate: (value: string) => void;
  setRangeEndDate: (value: string) => void;
  setDraftColor: (value: string) => void;
  setRecurrenceType: (value: RecurrenceType) => void;
  setRecurrenceUntil: (value: string) => void;
  toggleWeeklyDay: (index: number) => void;
  updateCyclePatternItem: (
    index: number,
    patch: Partial<CalendarRecurrenceCycleItem>
  ) => void;
  addCyclePatternItem: () => void;
  removeCyclePatternItem: (index: number) => void;
  setRangeEnabled: (value: boolean) => void;
};

export function CalendarEventDialog({
  open,
  editingEventId,
  canCreate,
  draftTitle,
  draftTime,
  draftStartTime,
  draftEndTime,
  draftStartDate,
  draftEndDate,
  draftColor,
  isRange,
  recurrenceType,
  recurrenceUntil,
  weeklyDays,
  cyclePattern,
  onClose,
  onSubmit,
  setDraftTitle,
  setDraftTime,
  setDraftStartTime,
  setDraftEndTime,
  setRangeStartDate,
  setRangeEndDate,
  setDraftColor,
  setRecurrenceType,
  setRecurrenceUntil,
  toggleWeeklyDay,
  updateCyclePatternItem,
  addCyclePatternItem,
  removeCyclePatternItem,
  setRangeEnabled,
}: CalendarEventDialogProps) {
  const isEditing = Boolean(editingEventId);
  const isWeekly = recurrenceType === "weekly";
  const isCycle = recurrenceType === "cycle";
  const isYearly = recurrenceType === "yearly";
  const scheduleMode: ScheduleMode = isYearly
    ? "anniversary"
    : recurrenceType !== "none"
      ? "recurrence"
      : isRange
        ? "range"
        : "single";
  const showSingleTime =
    scheduleMode === "single" ||
    (scheduleMode === "recurrence" && recurrenceType === "weekly");
  const isRangeMode = scheduleMode === "range";
  const dateLabel =
    scheduleMode === "anniversary"
      ? "기념일 날짜"
      : scheduleMode === "recurrence"
        ? "기준 날짜"
        : "시작 날짜";
  const hasRangeTime = Boolean(draftStartTime) || Boolean(draftEndTime);
  const isRangeTimeValid =
    !hasRangeTime || (Boolean(draftStartTime) && Boolean(draftEndTime));
  const isWeeklyValid = !isWeekly || weeklyDays.length > 0;
  const isCyclePatternValid =
    !isCycle ||
    (cyclePattern.length > 0 &&
      cyclePattern.every((item) => {
        const days = item.days ?? 1;
        return Number.isFinite(days) && days > 0;
      }));
  const canSubmit =
    canCreate &&
    draftTitle.trim().length > 0 &&
    Boolean(draftStartDate) &&
    (!isRangeMode || Boolean(draftEndDate)) &&
    (!isRangeMode || isRangeTimeValid) &&
    isWeeklyValid &&
    isCyclePatternValid;

  const setScheduleMode = (next: ScheduleMode) => {
    if (next === "single") {
      setRecurrenceType("none");
      setRangeEnabled(false);
      return;
    }
    if (next === "range") {
      setRecurrenceType("none");
      setRangeEnabled(true);
      return;
    }
    if (next === "anniversary") {
      setRecurrenceType("yearly");
      setRangeEnabled(false);
      setDraftTime("");
      setDraftStartTime("");
      setDraftEndTime("");
      setRecurrenceUntil("");
      return;
    }
    if (recurrenceType === "none" || recurrenceType === "yearly") {
      setRecurrenceType("weekly");
    }
    setRangeEnabled(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "일정 수정" : "일정 추가"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <input
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="일정 제목"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            autoFocus
          />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>일정 종류</span>
            <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 p-1 dark:border-gray-700">
              {[
                { value: "single", label: "당일 일정" },
                { value: "range", label: "기간 일정" },
                { value: "recurrence", label: "반복 일정" },
                { value: "anniversary", label: "기념일" },
              ].map((option) => {
                const isActive = scheduleMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/40"
                    )}
                    onClick={() => setScheduleMode(option.value as ScheduleMode)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {scheduleMode === "range" ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>시작 날짜</span>
                <span>끝 날짜</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="Start date"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={draftStartDate}
                  max={draftEndDate}
                  onChange={(event) => setRangeStartDate(event.target.value)}
                />
                <input
                  type="date"
                  aria-label="End date"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={draftEndDate}
                  min={draftStartDate}
                  onChange={(event) => setRangeEndDate(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>시작 시간</span>
                <span>끝 시간</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  aria-label="Start time"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={draftStartTime}
                  onChange={(event) => setDraftStartTime(event.target.value)}
                />
                <input
                  type="time"
                  aria-label="End time"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={draftEndTime}
                  onChange={(event) => setDraftEndTime(event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "grid gap-2 text-xs text-gray-500",
                  showSingleTime ? "grid-cols-2" : "grid-cols-1"
                )}
              >
                <span>{dateLabel}</span>
                {showSingleTime ? <span>시작 시간</span> : null}
              </div>
              <div
                className={cn(
                  "grid gap-2",
                  showSingleTime ? "grid-cols-2" : "grid-cols-1"
                )}
              >
                <input
                  type="date"
                  aria-label="Start date"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={draftStartDate}
                  onChange={(event) => setRangeStartDate(event.target.value)}
                />
                {showSingleTime ? (
                  <input
                    type="time"
                    aria-label="Start time"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    value={draftTime}
                    onChange={(event) => setDraftTime(event.target.value)}
                  />
                ) : null}
              </div>
            </>
          )}
          {scheduleMode === "recurrence" ? (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>반복 유형</span>
              <select
                aria-label="Recurrence type"
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                value={recurrenceType}
                onChange={(event) =>
                  setRecurrenceType(event.target.value as RecurrenceType)
                }
              >
                <option value="weekly">요일 반복</option>
                <option value="cycle">교대 패턴</option>
              </select>
            </div>
          ) : null}
          {scheduleMode === "recurrence" ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>반복 종료</span>
                <span className="text-right">선택</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="Recurrence end date"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  value={recurrenceUntil}
                  min={draftStartDate}
                  onChange={(event) => setRecurrenceUntil(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40"
                  onClick={() => setRecurrenceUntil("")}
                >
                  무기한
                </button>
              </div>
            </>
          ) : null}
          {scheduleMode === "recurrence" && isWeekly ? (
            <>
              <div className="text-xs text-gray-500">요일 선택</div>
              <div className="grid grid-cols-7 gap-1">
                {WEEK_DAYS.map((day, index) => {
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
          {scheduleMode === "recurrence" && isCycle ? (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>교대 패턴</span>
                <button
                  type="button"
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40"
                  onClick={addCyclePatternItem}
                >
                  + 항목 추가
                </button>
              </div>
              <div className="space-y-2">
                {cyclePattern.map((item, index) => (
                  <div
                    key={`cycle-${index}`}
                    className="grid grid-cols-[1.4fr_0.6fr_auto_auto] items-center gap-2"
                  >
                    <div className="flex flex-col gap-1">
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
                        공백
                      </label>
                      <input
                        aria-label={`Pattern label ${index + 1}`}
                        className={cn(
                          "w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500",
                          item.isGap
                            ? "text-gray-400 placeholder:text-gray-400"
                            : ""
                        )}
                        placeholder={item.isGap ? "공백" : `패턴 ${index + 1}`}
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
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      value={item.days ?? 1}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        updateCyclePatternItem(index, {
                          days: Number.isFinite(next) ? next : 1,
                        });
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={`${index}-${color}`}
                            type="button"
                            aria-label={`Set pattern color ${color}`}
                            className={cn(
                              "h-5 w-5 rounded-full border border-gray-200",
                              (item.color ?? draftColor) === color
                                ? "ring-2 ring-gray-900/50"
                                : "",
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
                      className="text-xs font-medium text-gray-400 transition hover:text-red-500"
                      onClick={() => removeCyclePatternItem(index)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              {!isCyclePatternValid ? (
                <div className="text-xs text-rose-500">
                  일수는 1 이상이어야 합니다.
                </div>
              ) : null}
            </>
          ) : null}
          {!isCycle ? (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span>색상</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Event color"
                    className="h-6 w-8 rounded border border-gray-200 bg-transparent p-0"
                    value={draftColor}
                    onChange={(event) =>
                      setDraftColor(event.target.value || DEFAULT_EVENT_COLOR)
                    }
                  />
                  <span className="text-xs font-mono text-gray-400">
                    {draftColor}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set color ${color}`}
                    className={cn(
                      "h-5 w-5 rounded-full border border-gray-200",
                      draftColor === color ? "ring-2 ring-gray-900/50" : ""
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setDraftColor(color)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isEditing ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
