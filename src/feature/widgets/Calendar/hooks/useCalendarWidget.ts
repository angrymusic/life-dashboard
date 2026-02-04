import { useCallback, useMemo, useState } from "react";
import type {
  CalendarEvent,
  CalendarRecurrence,
  CalendarRecurrenceCycleItem,
  Id,
  YMD,
} from "@/shared/db/schema";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  newId,
  nowIso,
  updateCalendarEvent,
} from "@/shared/db/db";
import { useCalendarEvents, useWidget } from "@/shared/db/queries";
import {
  DEFAULT_EVENT_COLOR,
  CalendarEventInstance,
  addDays,
  buildCalendarDays,
  buildStartAt,
  expandCalendarEvents,
  endOfDay,
  formatTimeInput,
  getCalendarViewRange,
  parseTimeInput,
  shiftYmd,
  shiftMonth,
  startOfDay,
  startOfMonth,
  toDateFromYmd,
  toYmd,
} from "@/feature/widgets/Calendar/libs/calendarUtils";

type RecurrenceType = "none" | "weekly" | "cycle" | "yearly";
type DeleteScope = "all" | "future";

const DEFAULT_CYCLE_PATTERN: CalendarRecurrenceCycleItem[] = [
  { label: "주간", days: 1 },
  { label: "야간", days: 1 },
  { label: "비번", days: 1 },
  { label: "휴무", days: 1 },
];

export function useCalendarWidget(widgetId: Id) {
  const events = useCalendarEvents(widgetId);
  const widget = useWidget(widgetId);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("");
  const [draftEndTime, setDraftEndTime] = useState("");
  const [draftColor, setDraftColor] = useState(DEFAULT_EVENT_COLOR);
  const [draftStartDate, setDraftStartDate] = useState<YMD>(() =>
    toYmd(new Date())
  );
  const [draftEndDate, setDraftEndDate] = useState<YMD>(() => toYmd(new Date()));
  const [isRange, setIsRange] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingEventId, setEditingEventId] = useState<Id | null>(null);
  const [recurrenceType, setRecurrenceTypeState] =
    useState<RecurrenceType>("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState<YMD | "">("");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [cyclePattern, setCyclePattern] = useState<
    CalendarRecurrenceCycleItem[]
  >(DEFAULT_CYCLE_PATTERN);

  const selectedYmd = useMemo(() => toYmd(selectedDate), [selectedDate]);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const viewDate = useMemo(() => startOfMonth(selectedDate), [selectedDate]);
  const viewRange = useMemo(() => getCalendarViewRange(viewDate), [viewDate]);
  const eventsById = useMemo(() => {
    const map = new Map<Id, CalendarEvent>();
    for (const event of events ?? []) {
      map.set(event.id, event);
    }
    return map;
  }, [events]);

  const expandedEvents = useMemo(
    () =>
      expandCalendarEvents(
        events ?? [],
        viewRange.start,
        viewRange.end
      ),
    [events, viewRange.start, viewRange.end]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<YMD, CalendarEventInstance[]>();
    const viewStart = startOfDay(viewRange.start);
    const viewEnd = startOfDay(viewRange.end);

    for (const event of expandedEvents) {
      const start = new Date(event.startAt);
      if (Number.isNaN(start.getTime())) continue;
      const endCandidate = event.endAt ? new Date(event.endAt) : null;
      const end =
        endCandidate && !Number.isNaN(endCandidate.getTime())
          ? endCandidate
          : start;

      const startDay = startOfDay(start);
      const endDay = startOfDay(end);
      const safeStart =
        startDay.getTime() < viewStart.getTime() ? viewStart : startDay;
      const safeEnd = endDay.getTime() > viewEnd.getTime() ? viewEnd : endDay;
      if (safeEnd.getTime() < safeStart.getTime()) continue;

      let cursor = safeStart;
      while (cursor.getTime() <= safeEnd.getTime()) {
        const ymd = toYmd(cursor);
        const list = map.get(ymd) ?? [];
        list.push(event);
        map.set(ymd, list);
        cursor = addDays(cursor, 1);
      }
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    }
    return map;
  }, [expandedEvents, viewRange.start, viewRange.end]);

  const calendarDays = useMemo(
    () => buildCalendarDays(viewDate, eventsByDate),
    [viewDate, eventsByDate]
  );
  const selectedEvents = useMemo(
    () => eventsByDate.get(selectedYmd) ?? [],
    [eventsByDate, selectedYmd]
  );

  const goPrevMonth = useCallback(() => {
    setSelectedDate((prev) => shiftMonth(prev, -1));
  }, []);

  const goNextMonth = useCallback(() => {
    setSelectedDate((prev) => shiftMonth(prev, 1));
  }, []);

  const goToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const startAdd = useCallback(() => {
    setIsAdding(true);
    setEditingEventId(null);
    setDraftTitle("");
    setDraftTime("");
    setDraftStartTime("");
    setDraftEndTime("");
    setDraftColor(DEFAULT_EVENT_COLOR);
    setDraftStartDate(selectedYmd);
    setDraftEndDate(selectedYmd);
    setIsRange(false);
    setRecurrenceTypeState("none");
    setRecurrenceUntil("");
    setWeeklyDays([]);
    setCyclePattern(DEFAULT_CYCLE_PATTERN);
  }, [selectedYmd]);

  const setRangeEnabled = useCallback(
    (next: boolean) => {
      setIsRange(next);
      if (next) {
        const startYmd = draftStartDate || selectedYmd;
        setDraftTime("");
        setDraftStartTime("");
        setDraftEndTime("");
        setDraftStartDate(startYmd);
        setDraftEndDate((prev) => (prev < startYmd ? startYmd : prev));
        return;
      }
      if (!draftTime && draftStartTime) {
        setDraftTime(draftStartTime);
      }
      setDraftStartTime("");
      setDraftEndTime("");
    },
    [draftStartDate, draftStartTime, draftTime, selectedYmd]
  );

  const setRecurrenceType = useCallback(
    (next: RecurrenceType) => {
      setRecurrenceTypeState(next);
      if (next === "none") {
        setRecurrenceUntil("");
        return;
      }
      if (next === "weekly") {
        if (weeklyDays.length === 0) {
          const baseDate = draftStartDate
            ? toDateFromYmd(draftStartDate)
            : selectedDate;
          const safeDate = Number.isNaN(baseDate.getTime())
            ? selectedDate
            : baseDate;
          setWeeklyDays([safeDate.getDay()]);
        }
        return;
      }
      if (next === "cycle") {
        if (cyclePattern.length === 0) {
          setCyclePattern(DEFAULT_CYCLE_PATTERN);
        }
        return;
      }
      if (next === "yearly") {
        return;
      }
    },
    [cyclePattern.length, draftStartDate, selectedDate, weeklyDays.length]
  );

  const toggleWeeklyDay = useCallback((dayIndex: number) => {
    setWeeklyDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((day) => day !== dayIndex);
      }
      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  }, []);

  const updateCyclePatternItem = useCallback(
    (index: number, patch: Partial<CalendarRecurrenceCycleItem>) => {
      setCyclePattern((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item
        )
      );
    },
    []
  );

  const addCyclePatternItem = useCallback(() => {
    setCyclePattern((prev) => [...prev, { label: "", days: 1 }]);
  }, []);

  const removeCyclePatternItem = useCallback((index: number) => {
    setCyclePattern((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setEditingEventId(null);
    setDraftTitle("");
    setDraftTime("");
    setDraftStartTime("");
    setDraftEndTime("");
    setDraftColor(DEFAULT_EVENT_COLOR);
    setDraftStartDate(selectedYmd);
    setDraftEndDate(selectedYmd);
    setIsRange(false);
    setRecurrenceTypeState("none");
    setRecurrenceUntil("");
    setWeeklyDays([]);
    setCyclePattern(DEFAULT_CYCLE_PATTERN);
  }, [selectedYmd]);

  const startEdit = useCallback(
    (event: CalendarEvent) => {
      const baseEvent = eventsById.get(event.id) ?? event;
      const start = new Date(baseEvent.startAt);
      if (Number.isNaN(start.getTime())) return;
      const startYmd = toYmd(start);
      const end = baseEvent.endAt ? new Date(baseEvent.endAt) : null;
      const hasValidEnd = end !== null && !Number.isNaN(end.getTime());
      const endYmd = hasValidEnd ? toYmd(end) : startYmd;
      const isRangeEvent = Boolean(hasValidEnd);

      setIsAdding(true);
      setEditingEventId(baseEvent.id);
      setDraftTitle(baseEvent.title);
      setDraftColor(baseEvent.color ?? DEFAULT_EVENT_COLOR);
      setDraftStartDate(startYmd);
      setDraftEndDate(endYmd);
      setIsRange(isRangeEvent);
      setSelectedDate(start);

      if (!baseEvent.recurrence) {
        setRecurrenceTypeState("none");
        setRecurrenceUntil("");
        setWeeklyDays([]);
        setCyclePattern(DEFAULT_CYCLE_PATTERN);
      } else if (baseEvent.recurrence.type === "weekly") {
        setRecurrenceTypeState("weekly");
        setRecurrenceUntil(baseEvent.recurrence.until ?? "");
        setWeeklyDays(baseEvent.recurrence.daysOfWeek ?? []);
      } else if (baseEvent.recurrence.type === "yearly") {
        setRecurrenceTypeState("yearly");
        setRecurrenceUntil(baseEvent.recurrence.until ?? "");
      } else if (baseEvent.recurrence.type === "cycle") {
        setRecurrenceTypeState("cycle");
        setRecurrenceUntil(baseEvent.recurrence.until ?? "");
        setCyclePattern(
          baseEvent.recurrence.pattern.length
            ? baseEvent.recurrence.pattern.map((item) => ({
                ...item,
                days: item.days ?? 1,
              }))
            : DEFAULT_CYCLE_PATTERN
        );
      }

      if (baseEvent.recurrence) {
        setIsRange(false);
      }

      if (baseEvent.recurrence?.type === "cycle") {
        setIsRange(false);
        setDraftEndDate(startYmd);
        setDraftStartTime("");
        setDraftEndTime("");
        setDraftTime("");
        return;
      }

      if (baseEvent.recurrence?.type === "yearly") {
        setDraftStartTime("");
        setDraftEndTime("");
        setDraftTime("");
        return;
      }

      if (isRangeEvent) {
        if (!baseEvent.allDay && hasValidEnd) {
          setDraftStartTime(formatTimeInput(start));
          setDraftEndTime(formatTimeInput(end ?? start));
        } else {
          setDraftStartTime("");
          setDraftEndTime("");
        }
        setDraftTime("");
        return;
      }

      setDraftStartTime("");
      setDraftEndTime("");
      setDraftTime(!baseEvent.allDay ? formatTimeInput(start) : "");
    },
    [eventsById]
  );

  const addEvent = useCallback(async () => {
    if (!widget) return;
    const title = draftTitle.trim();
    if (!title) return;

    let startAt: Date;
    let endAt: Date | undefined;
    let allDay: boolean;
    let recurrence: CalendarRecurrence | undefined;

    if (recurrenceType === "cycle") {
      if (cyclePattern.length === 0) return;
      const normalizedPattern = cyclePattern
        .map((item) => ({
          ...item,
          days: Math.max(1, Math.floor(item.days ?? 1)),
        }))
        .filter((item) => (item.days ?? 0) > 0);
      if (normalizedPattern.length === 0) return;
      const startDate = draftStartDate
        ? toDateFromYmd(draftStartDate)
        : selectedDate;
      const safeStart = Number.isNaN(startDate.getTime())
        ? selectedDate
        : startDate;
      startAt = startOfDay(safeStart);
      endAt = undefined;
      allDay = true;

      recurrence = {
        type: "cycle",
        pattern: normalizedPattern,
        until: recurrenceUntil || undefined,
      };
    } else {
      const isYearly = recurrenceType === "yearly";
      if (recurrenceType === "weekly") {
        if (weeklyDays.length === 0) return;
        recurrence = {
          type: "weekly",
          daysOfWeek: weeklyDays,
          until: recurrenceUntil || undefined,
        };
      }
      if (isYearly) {
        recurrence = {
          type: "yearly",
          until: recurrenceUntil || undefined,
        };
      }

      if (isRange && !isYearly) {
        const startDate = draftStartDate
          ? toDateFromYmd(draftStartDate)
          : selectedDate;
        const endDate = draftEndDate
          ? toDateFromYmd(draftEndDate)
          : startDate;
        const startTime = parseTimeInput(draftStartTime);
        const endTime = parseTimeInput(draftEndTime);
        const hasRangeTimes = Boolean(draftStartTime) || Boolean(draftEndTime);

        if (hasRangeTimes && (!startTime || !endTime)) return;

        const startDay = Number.isNaN(startDate.getTime())
          ? startOfDay(selectedDate)
          : startOfDay(startDate);
        const endDay = Number.isNaN(endDate.getTime())
          ? startDay
          : startOfDay(endDate);
        const safeEnd =
          endDay.getTime() < startDay.getTime() ? startDay : endDay;

        if (!startTime || !endTime) {
          startAt = startDay;
          endAt = endOfDay(safeEnd);
          allDay = true;
        } else {
          startAt = new Date(
            startDay.getFullYear(),
            startDay.getMonth(),
            startDay.getDate(),
            startTime.hours,
            startTime.minutes,
            0
          );
          const endCandidate = new Date(
            safeEnd.getFullYear(),
            safeEnd.getMonth(),
            safeEnd.getDate(),
            endTime.hours,
            endTime.minutes,
            0
          );
          const safeEndAt =
            endCandidate.getTime() < startAt.getTime()
              ? startAt
              : endCandidate;
          endAt = safeEndAt;
          allDay = false;
        }
      } else {
        const startDate = draftStartDate
          ? toDateFromYmd(draftStartDate)
          : selectedDate;
        const safeStart = Number.isNaN(startDate.getTime())
          ? selectedDate
          : startDate;
        if (isYearly) {
          startAt = startOfDay(safeStart);
          allDay = true;
          endAt = undefined;
        } else {
          const built = buildStartAt(safeStart, draftTime);
          startAt = built.startAt;
          allDay = built.allDay;
          endAt = undefined;
        }
      }
    }
    const now = nowIso();

    const event: CalendarEvent = {
      id: newId(),
      widgetId,
      dashboardId: widget.dashboardId,
      title,
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : undefined,
      allDay,
      color: draftColor || DEFAULT_EVENT_COLOR,
      recurrence,
      location: undefined,
      description: undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (editingEventId) {
      await updateCalendarEvent(editingEventId, {
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        color: event.color,
        recurrence: event.recurrence,
      });
    } else {
      await addCalendarEvent(event);
    }

    setDraftTitle("");
    setDraftTime("");
    setDraftStartTime("");
    setDraftEndTime("");
    setDraftStartDate(selectedYmd);
    setDraftEndDate(selectedYmd);
    setIsRange(false);
    setIsAdding(false);
    setEditingEventId(null);
    setRecurrenceTypeState("none");
    setRecurrenceUntil("");
    setWeeklyDays([]);
    setCyclePattern(DEFAULT_CYCLE_PATTERN);
  }, [
    widget,
    editingEventId,
    widgetId,
    selectedDate,
    selectedYmd,
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
  ]);

  const deleteEvent = useCallback(
    async (
      event: CalendarEventInstance,
      scope: DeleteScope = "all",
      fromYmd?: YMD
    ) => {
      const baseEvent = eventsById.get(event.id);
      if (!event.recurrence || scope === "all" || !baseEvent || !baseEvent.recurrence) {
        await deleteCalendarEvent(event.id);
        return;
      }

      const occurrenceStart = new Date(event.startAt);
      const occurrenceYmd = !Number.isNaN(occurrenceStart.getTime())
        ? toYmd(startOfDay(occurrenceStart))
        : fromYmd || toYmd(startOfDay(new Date()));
      const baseStart = new Date(baseEvent.startAt);
      if (Number.isNaN(baseStart.getTime())) {
        await deleteCalendarEvent(event.id);
        return;
      }
      const baseStartYmd = toYmd(startOfDay(baseStart));

      if (occurrenceYmd <= baseStartYmd) {
        await deleteCalendarEvent(event.id);
        return;
      }

      const updatedRecurrence: CalendarRecurrence = {
        ...baseEvent.recurrence,
        until: shiftYmd(occurrenceYmd, -1),
      };
      await updateCalendarEvent(event.id, { recurrence: updatedRecurrence });
    },
    [eventsById]
  );

  const setRangeStartDate = useCallback(
    (value: YMD) => {
      setDraftStartDate(value);
      const date = toDateFromYmd(value);
      if (!Number.isNaN(date.getTime())) {
        setSelectedDate(date);
      }
      if (draftEndDate < value) {
        setDraftEndDate(value);
      }
    },
    [draftEndDate]
  );

  const setRangeEndDate = useCallback((value: YMD) => {
    setDraftEndDate(value);
  }, []);

  return {
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
    draftColor,
    draftStartDate,
    draftEndDate,
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
    canCreate: Boolean(widget?.dashboardId),
  };
}
