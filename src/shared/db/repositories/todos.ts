import type { Id, Todo, YMD } from "../schema";
import { db, newId, nowIso } from "../core";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDelete,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

export async function addTodoItem(
  params: {
    widgetId: Id;
    dashboardId: Id;
    date: YMD;
    title: string;
    done?: boolean;
    order?: number;
  },
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(params.dashboardId, options);
  const now = nowIso();
  const todo: Todo = {
    id: newId(),
    widgetId: params.widgetId,
    dashboardId: params.dashboardId,
    date: params.date,
    title: params.title,
    done: params.done ?? false,
    order: params.order,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.add(todo);
    await recordOutboxUpsert({
      entityType: "todo",
      record: todo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("todo", todo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
  return todo.id;
}

export async function toggleTodoItem(todo: Todo, options: WriteOptions = {}) {
  const policy = await resolveWritePolicy(todo.dashboardId, options);
  const now = nowIso();
  const nextTodo: Todo = { ...todo, done: !todo.done, updatedAt: now };
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.update(todo.id, { done: nextTodo.done, updatedAt: now });
    await recordOutboxUpsert({
      entityType: "todo",
      record: nextTodo,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("todo", nextTodo, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteTodoItem(todoId: Id, options: WriteOptions = {}) {
  const existing = await db.todos.get(todoId);
  if (!existing) return;
  const policy = await resolveWritePolicy(existing.dashboardId, options);
  await db.transaction("rw", [db.todos, db.outbox], async () => {
    await db.todos.delete(todoId);
    await recordOutboxDelete({
      entityType: "todo",
      entityId: todoId,
      dashboardId: existing.dashboardId,
      widgetId: existing.widgetId,
      options: { skipOutbox: policy.skipOutbox },
    });
  });
  if (policy.syncToServer) {
    const event = buildDeleteEventForRecord("todo", existing);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}
