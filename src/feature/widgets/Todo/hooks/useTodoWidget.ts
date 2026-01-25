import { useCallback, useMemo, useState } from "react";
import { db, newId, nowIso } from "@/shared/db/db";
import { useTodosByDate, useWidget } from "@/shared/db/queries";
import type { Id, Todo, YMD } from "@/shared/db/schema";

function toYmd(date: Date): YMD {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as YMD;
}

function shiftDate(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function useTodoWidget(widgetId: Id) {
  const widget = useWidget(widgetId);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedYmd = useMemo(() => toYmd(selectedDate), [selectedDate]);
  const todos = useTodosByDate(widgetId, selectedYmd);
  const [draftTitle, setDraftTitle] = useState("");

  const orderedTodos = useMemo(() => {
    const list = todos ?? [];
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const aOrder =
        typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder =
        typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [todos]);

  const nextOrder = useMemo(() => {
    const list = todos ?? [];
    return (
      list.reduce((max, item, index) => {
        const order = typeof item.order === "number" ? item.order : index;
        return Math.max(max, order);
      }, -1) + 1
    );
  }, [todos]);

  const addTodo = useCallback(async () => {
    if (!widget) return;
    const title = draftTitle.trim();
    if (!title) return;

    const now = nowIso();
    await db.todos.add({
      id: newId(),
      widgetId,
      dashboardId: widget.dashboardId,
      date: selectedYmd,
      title,
      done: false,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    });
    setDraftTitle("");
  }, [draftTitle, widget, widgetId, selectedYmd, nextOrder]);

  const toggleTodo = useCallback(async (todo: Todo) => {
    await db.todos.update(todo.id, {
      done: !todo.done,
      updatedAt: nowIso(),
    });
  }, []);

  const deleteTodo = useCallback(async (todoId: Id) => {
    await db.todos.delete(todoId);
  }, []);

  const goPrevDay = useCallback(() => {
    setSelectedDate((prev) => shiftDate(prev, -1));
  }, []);

  const goNextDay = useCallback(() => {
    setSelectedDate((prev) => shiftDate(prev, 1));
  }, []);

  const goToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const isToday = useMemo(
    () => isSameDay(selectedDate, new Date()),
    [selectedDate]
  );

  return {
    todos: orderedTodos,
    selectedDate,
    selectedYmd,
    isToday,
    draftTitle,
    setDraftTitle,
    addTodo,
    toggleTodo,
    deleteTodo,
    goPrevDay,
    goNextDay,
    goToday,
  };
}
