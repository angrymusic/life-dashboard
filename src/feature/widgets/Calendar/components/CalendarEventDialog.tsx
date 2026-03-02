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
  getWeekDayLabels,
} from "@/feature/widgets/Calendar/libs/calendarUtils";
import { useI18n } from "@/shared/i18n/client";
import {
  AnniversaryScheduleSection,
  type AnniversaryCalendar,
  FIELD_INPUT_CLASS,
  RangeScheduleSection,
  RecurrenceScheduleSection,
  type RecurrenceType,
  type ScheduleMode,
  SegmentedOptionRow,
  SingleScheduleSection,
} from "@/feature/widgets/Calendar/components/CalendarEventDialogSections";

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
  anniversaryCalendar: AnniversaryCalendar;
  draftLunarLeapMonth: boolean;
  lunarPreviewYmd: string;
  isLunarAnniversaryValid: boolean;
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
  setAnniversaryCalendar: (value: AnniversaryCalendar) => void;
  setDraftLunarLeapMonth: (value: boolean) => void;
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
  anniversaryCalendar,
  draftLunarLeapMonth,
  lunarPreviewYmd,
  isLunarAnniversaryValid,
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
  setAnniversaryCalendar,
  setDraftLunarLeapMonth,
  toggleWeeklyDay,
  updateCyclePatternItem,
  addCyclePatternItem,
  removeCyclePatternItem,
  setRangeEnabled,
}: CalendarEventDialogProps) {
  const { t, locale } = useI18n();
  const weekDays = getWeekDayLabels(locale);
  const isEditing = Boolean(editingEventId);
  const isWeekly = recurrenceType === "weekly";
  const isCycle = recurrenceType === "cycle";
  const isYearly = recurrenceType === "yearly";

  const scheduleMode: ScheduleMode = (() => {
    if (isYearly) return "anniversary";
    if (recurrenceType !== "none") return "recurrence";
    if (isRange) return "range";
    return "single";
  })();

  const isAnniversaryMode = scheduleMode === "anniversary";
  const isRangeMode = scheduleMode === "range";
  const isLunarAnniversary = isAnniversaryMode && anniversaryCalendar === "lunar";

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
    (!isLunarAnniversary || isLunarAnniversaryValid) &&
    isWeeklyValid &&
    isCyclePatternValid;

  const scheduleOptions: { value: ScheduleMode; label: string }[] = [
    { value: "single", label: t("당일 일정", "Single day") },
    { value: "range", label: t("기간 일정", "Date range") },
    { value: "recurrence", label: t("반복 일정", "Recurring") },
    { value: "anniversary", label: t("기념일", "Anniversary") },
  ];

  const setScheduleMode = (next: ScheduleMode) => {
    switch (next) {
      case "single":
        setRecurrenceType("none");
        setRangeEnabled(false);
        return;
      case "range":
        setRecurrenceType("none");
        setRangeEnabled(true);
        return;
      case "anniversary":
        setRecurrenceType("yearly");
        setRangeEnabled(false);
        setDraftTime("");
        setDraftStartTime("");
        setDraftEndTime("");
        setRecurrenceUntil("");
        return;
      case "recurrence":
        if (recurrenceType === "none" || recurrenceType === "yearly") {
          setRecurrenceType("weekly");
        }
        setRangeEnabled(false);
        return;
    }
  };

  const scheduleSection = (() => {
    switch (scheduleMode) {
      case "single":
        return (
          <SingleScheduleSection
            draftStartDate={draftStartDate}
            draftTime={draftTime}
            setRangeStartDate={setRangeStartDate}
            setDraftTime={setDraftTime}
            t={t}
          />
        );
      case "range":
        return (
          <RangeScheduleSection
            draftStartDate={draftStartDate}
            draftEndDate={draftEndDate}
            draftStartTime={draftStartTime}
            draftEndTime={draftEndTime}
            setRangeStartDate={setRangeStartDate}
            setRangeEndDate={setRangeEndDate}
            setDraftStartTime={setDraftStartTime}
            setDraftEndTime={setDraftEndTime}
            t={t}
          />
        );
      case "recurrence":
        return (
          <RecurrenceScheduleSection
            recurrenceType={recurrenceType}
            setRecurrenceType={setRecurrenceType}
            recurrenceUntil={recurrenceUntil}
            setRecurrenceUntil={setRecurrenceUntil}
            draftStartDate={draftStartDate}
            draftTime={draftTime}
            setRangeStartDate={setRangeStartDate}
            setDraftTime={setDraftTime}
            weekDays={weekDays}
            weeklyDays={weeklyDays}
            toggleWeeklyDay={toggleWeeklyDay}
            cyclePattern={cyclePattern}
            draftColor={draftColor}
            addCyclePatternItem={addCyclePatternItem}
            updateCyclePatternItem={updateCyclePatternItem}
            removeCyclePatternItem={removeCyclePatternItem}
            isCyclePatternValid={isCyclePatternValid}
            t={t}
          />
        );
      case "anniversary":
        return (
          <AnniversaryScheduleSection
            anniversaryCalendar={anniversaryCalendar}
            setAnniversaryCalendar={setAnniversaryCalendar}
            draftStartDate={draftStartDate}
            setRangeStartDate={setRangeStartDate}
            draftLunarLeapMonth={draftLunarLeapMonth}
            setDraftLunarLeapMonth={setDraftLunarLeapMonth}
            lunarPreviewYmd={lunarPreviewYmd}
            t={t}
          />
        );
    }
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("일정 수정", "Edit event") : t("일정 추가", "Add event")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <input
            className={FIELD_INPUT_CLASS}
            placeholder={t("일정 제목", "Event title")}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            autoFocus
          />

          <SegmentedOptionRow
            label={t("일정 종류", "Schedule type")}
            options={scheduleOptions}
            value={scheduleMode}
            onChange={setScheduleMode}
          />

          {scheduleSection}

          {!isCycle ? (
            <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span>{t("색상", "Color")}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    aria-label="Event color"
                    className="h-6 w-8 rounded border border-gray-200 bg-transparent p-0"
                    value={draftColor}
                    onChange={(event) =>
                      setDraftColor(event.target.value || DEFAULT_EVENT_COLOR)
                    }
                  />
                  <span className="truncate text-xs font-mono text-gray-400">
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
              {t("취소", "Cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isEditing ? t("저장", "Save") : t("추가", "Add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
