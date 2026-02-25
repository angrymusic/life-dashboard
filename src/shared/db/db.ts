export { db, LifeDashboardDB, getLocalMembersGroupId, getOrCreateLocalProfileId, newId, nowIso } from "./core";

export type { CreateWidgetPayload } from "./repositories/widgets";

export {
  createDashboard,
  deleteDashboardCascade,
  ensureDefaultDashboard,
  removeDefaultDraftDashboardForSignedInUser,
  removeSharedDashboardLocally,
  setDashboardGroupId,
  syncDashboardsFromServer,
  syncMembersFromServer,
  updateDashboardName,
} from "./repositories/dashboards";

export {
  addWidget,
  commitWidgetLayout,
  deleteWidgetCascade,
  updateWidgetLayout,
  updateWidgetSettings,
} from "./repositories/widgets";

export { updateMemoText } from "./repositories/memos";

export { addTodoItem, deleteTodoItem, toggleTodoItem } from "./repositories/todos";

export { addDday, deleteDdaysByIds, deleteDdaysByWidget, updateDday } from "./repositories/ddays";

export { addMood, deleteMoodsByIds, updateMood } from "./repositories/moods";

export { clearLocalPhotos, replaceLocalPhoto } from "./repositories/photos";

export {
  addMetricEntry,
  createMetric,
  deleteMetricEntry,
  updateMetric,
  updateMetricEntry,
} from "./repositories/metrics";

export { addCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./repositories/calendar";

export { upsertWeatherCache } from "./repositories/weather";

export {
  applyDashboardSnapshot,
  applyWidgetSnapshot,
  deleteWidgetSnapshot,
  exportDashboardSnapshot,
  exportLocalSnapshot,
  pushDashboardSnapshot,
} from "./snapshot";

export { clearOutboxForDashboard, flushOutbox } from "./outbox";

export {
  clearLocalDataExceptMigrationState,
  deleteLocalDatabase,
  getMigrationState,
  setMigrationState,
} from "./migration";
