import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCalendarWidget } from "@/feature/widgets/Calendar/hooks/useCalendarWidget";
import type { Id } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ActionMenuItem } from "@/shared/ui/buttons/DropdownButton";
import {
  CalendarEventInstance,
  WEEK_DAYS,
  formatEventTime,
  formatMonth,
  formatMonthDay,
  getContrastColor,
  normalizeColor,
  shiftYmd,
} from "@/feature/widgets/Calendar/libs/calendarUtils";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { CalendarEventDialog } from "@/feature/widgets/Calendar/components/CalendarEventDialog";
import { CalendarDeleteDialog } from "@/feature/widgets/Calendar/components/CalendarDeleteDialog";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { WidgetHeader } from "@/feature/widgets/shared/components/WidgetHeader";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { WeatherIcon } from "@/feature/widgets/Weather/components/WeatherIcon";
import { useWeatherForecast } from "@/feature/widgets/Weather/hooks/useWeatherForecast";
import { useWeatherLocation } from "@/feature/widgets/Weather/hooks/useWeatherLocation";
import type { WeatherForecastDay } from "@/feature/widgets/Weather/libs/openMeteo";

type CalendarWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function CalendarWidget({
  widgetId,
  canEdit = true,
}: CalendarWidgetProps) {
  const {
    calendarDays,
    selectedDate,
    selectedEvents,
    selectedYmd,
    todayYmd,
    viewDate,
    isAdding,
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
    setDraftTitle,
    setDraftTime,
    setDraftStartTime,
    setDraftEndTime,
    setDraftColor,
    setRangeStartDate,
    setRangeEndDate,
    setRecurrenceType,
    setRecurrenceUntil,
    toggleWeeklyDay,
    updateCyclePatternItem,
    addCyclePatternItem,
    removeCyclePatternItem,
    editingEventId,
    startAdd,
    startEdit,
    setRangeEnabled,
    cancelAdd,
    addEvent,
    deleteEvent,
    goPrevMonth,
    goNextMonth,
    goToday,
    selectDate,
    canCreate,
  } = useCalendarWidget(widgetId);

  const { location } = useWeatherLocation();
  const { forecast } = useWeatherForecast(widgetId, { location, days: 7 });
  const weatherByYmd = useMemo(() => {
    const map = new Map<string, WeatherForecastDay>();
    for (const day of forecast?.days ?? []) {
      map.set(day.ymd, day);
    }
    return map;
  }, [forecast?.days]);
  const weekEndYmd = useMemo(() => shiftYmd(todayYmd, 6), [todayYmd]);

  const extraActions = useMemo<ActionMenuItem[]>(
    () => [
      {
        text: "오늘로 이동",
        icon: <Calendar className="size-4" />,
        onClick: goToday,
      },
      {
        text: "새 일정",
        icon: <Plus className="size-4" />,
        onClick: startAdd,
        disabled: !canCreate,
      },
    ],
    [goToday, startAdd, canCreate]
  );
  const {
    actions,
    deleteDialog: {
      isOpen: isWidgetDeleteOpen,
      close: closeWidgetDeleteDialog,
      confirm: handleWidgetDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: "위젯 삭제",
    extraItems: extraActions,
  });
  const [deleteTarget, setDeleteTarget] =
    useState<CalendarEventInstance | null>(null);

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
  };

  const handleDeleteAll = async () => {
    if (!deleteTarget) return;
    await deleteEvent(deleteTarget, "all");
    setDeleteTarget(null);
  };

  const handleDeleteFuture = async () => {
    if (!deleteTarget) return;
    await deleteEvent(deleteTarget, "future", selectedYmd);
    setDeleteTarget(null);
  };

  return (
    <WidgetCard
      header={
        <WidgetHeader
          canEdit={canEdit}
          actions={actions}
          left={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={goPrevMonth}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-[72px] text-center text-sm font-semibold @[360px]:text-base">
                {formatMonth(viewDate)}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={goNextMonth}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">

        <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500">
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1 text-xs">
          {calendarDays.map((day) => {
            const isSelected = day.ymd === selectedYmd;
            const isToday = day.ymd === todayYmd;
            const weather = weatherByYmd.get(day.ymd);
            const shouldShowWeather =
              weather && day.ymd >= todayYmd && day.ymd <= weekEndYmd;
            const tempMax =
              weather && typeof weather.tempMax === "number"
                ? Math.round(weather.tempMax)
                : null;
            const tempMin =
              weather && typeof weather.tempMin === "number"
                ? Math.round(weather.tempMin)
                : null;
            const weatherTitle =
              tempMax !== null && tempMin !== null
                ? `${tempMin}° / ${tempMax}°`
                : undefined;
            const segments = day.segments;
            const overflow = day.overflow ?? 0;
            return (
              <button
                key={day.ymd}
                type="button"
                onClick={() => selectDate(day.date)}
                className={cn(
                  "flex h-[56px] flex-col rounded-md border border-transparent p-0.5 text-left transition @[360px]:h-[72px]",
                  day.inMonth
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400",
                  isSelected
                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                    : "hover:bg-primary/10 dark:hover:bg-primary/20",
                  isToday && !isSelected
                    ? "text-primary"
                    : ""
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-medium leading-none">
                  <div className="flex items-center gap-1">
                    <span>{day.date.getDate()}</span>
                    {isToday ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {shouldShowWeather ? (
                      <span
                        className="flex items-center gap-0.5 text-[10px] text-gray-500"
                        title={weatherTitle}
                      >
                        <WeatherIcon
                          code={weather?.weatherCode}
                          className="size-3"
                        />
                        {tempMax !== null ? (
                          <span className="hidden @[360px]:inline">
                            {tempMax}°
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {overflow > 0 ? (
                      <span className="text-[11px] text-gray-400">
                        +{overflow}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-0.5 space-y-0.5 hidden @[360px]:block">
                  {segments.map((segment, index) => {
                    if (!segment) {
                      return (
                        <div
                          key={`${day.ymd}-empty-${index}`}
                          className="h-3"
                          aria-hidden="true"
                        />
                      );
                    }
                    const eventColor = normalizeColor(segment.event.color);
                    const textColor = getContrastColor(eventColor);
                    const isAnniversaryEvent =
                      segment.event.recurrence?.type === "yearly";
                    const eventStyle = isAnniversaryEvent
                      ? { color: eventColor }
                      : {
                          backgroundColor: eventColor,
                          color: textColor,
                        };
                    return (
                      <div
                        key={`${segment.event.id}-${day.ymd}`}
                        title={segment.event.title}
                        className={cn(
                          "pointer-events-none flex h-3 items-center truncate px-1 text-[10px] font-medium leading-none",
                          segment.isStart ? "rounded-l-sm" : "",
                          segment.isEnd ? "rounded-r-sm" : "",
                          segment.isStart ? "" : "-ml-2",
                          segment.isEnd ? "" : "-mr-2",
                          isAnniversaryEvent
                            ? "border border-current bg-transparent"
                            : ""
                        )}
                        style={eventStyle}
                      >
                        {segment.isStart ? (
                          <span className="truncate">
                            {segment.event.title}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-base font-medium">
            {formatMonthDay(selectedDate)}
          </div>
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add event"
              onClick={startAdd}
              disabled={!canCreate}
            >
              <Plus className="size-4" />
            </Button>
          ) : null}
        </div>

        {canEdit ? (
          <CalendarEventDialog
            open={isAdding}
            editingEventId={editingEventId}
            canCreate={canCreate}
            draftTitle={draftTitle}
            draftTime={draftTime}
            draftStartTime={draftStartTime}
            draftEndTime={draftEndTime}
            draftStartDate={draftStartDate}
            draftEndDate={draftEndDate}
            draftColor={draftColor}
            isRange={isRange}
            recurrenceType={recurrenceType}
            recurrenceUntil={recurrenceUntil}
            weeklyDays={weeklyDays}
            cyclePattern={cyclePattern}
            onClose={cancelAdd}
            onSubmit={addEvent}
            setDraftTitle={setDraftTitle}
            setDraftTime={setDraftTime}
            setDraftStartTime={setDraftStartTime}
            setDraftEndTime={setDraftEndTime}
            setRangeStartDate={setRangeStartDate}
            setRangeEndDate={setRangeEndDate}
            setDraftColor={setDraftColor}
            setRecurrenceType={setRecurrenceType}
            setRecurrenceUntil={setRecurrenceUntil}
            toggleWeeklyDay={toggleWeeklyDay}
            updateCyclePatternItem={updateCyclePatternItem}
            addCyclePatternItem={addCyclePatternItem}
            removeCyclePatternItem={removeCyclePatternItem}
            setRangeEnabled={setRangeEnabled}
          />
        ) : null}
        {canEdit && deleteTarget ? (
          <CalendarDeleteDialog
            open
            event={deleteTarget}
            selectedDate={selectedDate}
            onClose={closeDeleteDialog}
            onDeleteAll={handleDeleteAll}
            onDeleteFuture={handleDeleteFuture}
          />
        ) : null}
        {canEdit ? (
          <WidgetDeleteDialog
            open={isWidgetDeleteOpen}
            widgetName="캘린더"
            onClose={closeWidgetDeleteDialog}
            onConfirm={handleWidgetDelete}
          />
        ) : null}

        <div className="mt-2 flex-1 min-h-0 overflow-auto">
          {selectedEvents.length === 0 ? (
            <div className="text-sm text-gray-400">일정이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => {
                const eventColor = normalizeColor(event.color);
                return (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 p-2"
                  >
                    <div className="flex min-w-0 gap-2">
                      <span
                        className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: eventColor }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-base font-medium">
                          {event.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatEventTime(event)}
                        </div>
                        {event.location ? (
                          <div className="truncate text-sm text-gray-400">
                            {event.location}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit event"
                          onClick={() => startEdit(event)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete event"
                          onClick={() => setDeleteTarget(event)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-sm text-gray-400 shrink-0">
          {!canEdit && <span className="opacity-70">읽기 전용</span>}
        </div>
      </div>
    </WidgetCard>
  );
}
