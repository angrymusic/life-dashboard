import type {
  CalendarEvent,
  Dashboard,
  Dday,
  Id,
  LocalPhoto,
  LocalSnapshot,
  Member,
  Memo,
  Metric,
  MetricEntry,
  Mood,
  Notice,
  Photo,
  Todo,
  WeatherCache,
  Widget,
} from "./schema";
import { db } from "./core";
import { ensureServerStoragePath, toPhotoRecord } from "./photo-sync";
import { clearOutboxForDashboard } from "./outbox";
import { syncMembersFromServer } from "./repositories/dashboards";

type DashboardSnapshot = {
  dashboard: Dashboard;
  widgets: Widget[];
  memos: Memo[];
  todos: Todo[];
  ddays: Dday[];
  photos: Photo[];
  moods: Mood[];
  notices: Notice[];
  metrics: Metric[];
  metricEntries: MetricEntry[];
  calendarEvents: CalendarEvent[];
  weatherCache: WeatherCache[];
  members?: Member[];
};

export async function exportDashboardSnapshot(dashboardId: Id) {
  const dashboard = await db.dashboards.get(dashboardId);
  if (!dashboard) return null;
  const [
    widgets,
    memos,
    todos,
    ddays,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
  ] = await Promise.all([
    db.widgets.where("dashboardId").equals(dashboardId).toArray(),
    db.memos.where("dashboardId").equals(dashboardId).toArray(),
    db.todos.where("dashboardId").equals(dashboardId).toArray(),
    db.ddays.where("dashboardId").equals(dashboardId).toArray(),
    db.moods.where("dashboardId").equals(dashboardId).toArray(),
    db.notices.where("dashboardId").equals(dashboardId).toArray(),
    db.metrics.where("dashboardId").equals(dashboardId).toArray(),
    db.metricEntries.where("dashboardId").equals(dashboardId).toArray(),
    db.calendarEvents.where("dashboardId").equals(dashboardId).toArray(),
    db.weatherCache.where("dashboardId").equals(dashboardId).toArray(),
    db.localPhotos.where("dashboardId").equals(dashboardId).toArray(),
  ]);

  const photos: Photo[] = [];
  for (const localPhoto of localPhotos) {
    if (!localPhoto.serverStoragePath && localPhoto.blob) {
      const storagePath = await ensureServerStoragePath(localPhoto);
      photos.push(toPhotoRecord(localPhoto, storagePath));
    } else if (localPhoto.serverStoragePath) {
      photos.push(toPhotoRecord(localPhoto, localPhoto.serverStoragePath));
    }
  }

  return {
    dashboard,
    widgets,
    memos,
    todos,
    ddays,
    photos,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
  } satisfies DashboardSnapshot;
}

export async function pushDashboardSnapshot(dashboardId: Id) {
  const snapshot = await exportDashboardSnapshot(dashboardId);
  if (!snapshot) return;
  const response = await fetch(`/api/dashboards/${dashboardId}/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error("Snapshot sync failed");
  }
}

export async function applyDashboardSnapshot(snapshot: DashboardSnapshot) {
  const dashboardId = snapshot.dashboard.id;
  const localPhotos: LocalPhoto[] = snapshot.photos.map((photo) => ({
    id: photo.id,
    widgetId: photo.widgetId,
    dashboardId: photo.dashboardId,
    mimeType: photo.mimeType,
    caption: photo.caption,
    takenAt: photo.takenAt,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    serverStoragePath: photo.storagePath,
  }));

  await db.transaction(
    "rw",
    [
      db.dashboards,
      db.widgets,
      db.memos,
      db.todos,
      db.ddays,
      db.localPhotos,
      db.moods,
      db.notices,
      db.metrics,
      db.metricEntries,
      db.calendarEvents,
      db.weatherCache,
    ],
    async () => {
      await Promise.all([
        db.widgets.where("dashboardId").equals(dashboardId).delete(),
        db.memos.where("dashboardId").equals(dashboardId).delete(),
        db.todos.where("dashboardId").equals(dashboardId).delete(),
        db.ddays.where("dashboardId").equals(dashboardId).delete(),
        db.localPhotos.where("dashboardId").equals(dashboardId).delete(),
        db.moods.where("dashboardId").equals(dashboardId).delete(),
        db.notices.where("dashboardId").equals(dashboardId).delete(),
        db.metrics.where("dashboardId").equals(dashboardId).delete(),
        db.metricEntries.where("dashboardId").equals(dashboardId).delete(),
        db.calendarEvents.where("dashboardId").equals(dashboardId).delete(),
        db.weatherCache.where("dashboardId").equals(dashboardId).delete(),
      ]);

      await db.dashboards.put(snapshot.dashboard);
      if (snapshot.widgets.length) await db.widgets.bulkPut(snapshot.widgets);
      if (snapshot.memos.length) await db.memos.bulkPut(snapshot.memos);
      if (snapshot.todos.length) await db.todos.bulkPut(snapshot.todos);
      if (snapshot.ddays.length) await db.ddays.bulkPut(snapshot.ddays);
      if (localPhotos.length) await db.localPhotos.bulkPut(localPhotos);
      if (snapshot.moods.length) await db.moods.bulkPut(snapshot.moods);
      if (snapshot.notices.length) await db.notices.bulkPut(snapshot.notices);
      if (snapshot.metrics.length) await db.metrics.bulkPut(snapshot.metrics);
      if (snapshot.metricEntries.length)
        await db.metricEntries.bulkPut(snapshot.metricEntries);
      if (snapshot.calendarEvents.length)
        await db.calendarEvents.bulkPut(snapshot.calendarEvents);
      if (snapshot.weatherCache.length)
        await db.weatherCache.bulkPut(snapshot.weatherCache);
    }
  );

  if (snapshot.members) {
    await syncMembersFromServer(snapshot.members, snapshot.dashboard.groupId);
  }
  await clearOutboxForDashboard(dashboardId);
}

export async function exportLocalSnapshot(): Promise<LocalSnapshot> {
  const [
    dashboards,
    widgets,
    memos,
    todos,
    ddays,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
    members,
  ] = await Promise.all([
    db.dashboards.toArray(),
    db.widgets.toArray(),

    db.memos.toArray(),
    db.todos.toArray(),
    db.ddays.toArray(),
    db.moods.toArray(),
    db.notices.toArray(),

    db.metrics.toArray(),
    db.metricEntries.toArray(),

    db.calendarEvents.toArray(),
    db.weatherCache.toArray(),

    db.localPhotos.toArray(),
    db.members.toArray(),
  ]);

  return {
    dashboards,
    widgets,
    memos,
    todos,
    ddays,
    moods,
    notices,
    metrics,
    metricEntries,
    calendarEvents,
    weatherCache,
    localPhotos,
    members,
  };
}
