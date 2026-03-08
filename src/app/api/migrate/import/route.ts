// app/api/migrate/import/route.ts
import { NextResponse } from "next/server";
import { jsonError, parseJson } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import {
  enforceRateLimit,
  parsePositiveIntEnv,
  sanitizePathSegment,
} from "@/server/request-guards";
import path from "path";
import fs from "fs/promises";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** =========
 *  Types
 *  ========= */
type ISODate = string;

type WidgetType =
  | "calendar"
  | "memo"
  | "photo"
  | "todo"
  | "dday"
  | "chart"
  | "notice"
  | "mood"
  | "weather";

type WidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

type Dashboard = {
  id: string;
  name: string;
  ownerId?: string;
  groupId?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};

type Widget = {
  id: string;
  dashboardId: string;
  type: WidgetType;
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  createdBy?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};

type WidgetDataBase = {
  id: string;
  widgetId: string;
  dashboardId: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};

type Memo = WidgetDataBase & { text: string; color?: string };
type Todo = WidgetDataBase & { date: string; title: string; done: boolean; order?: number };
type Dday = WidgetDataBase & { title: string; date: string; color?: string };
type Mood = WidgetDataBase & {
  date: string;
  mood: "great" | "good" | "ok" | "bad" | "awful";
  note?: string;
};
type Notice = WidgetDataBase & { title: string; body: string; pinned?: boolean };

type Metric = WidgetDataBase & { name: string; unit?: string; chartType?: "line" | "bar" };
type MetricEntry = WidgetDataBase & { metricId: string; date: string; value: number };

type CalendarRecurrenceWeekly = {
  type: "weekly";
  daysOfWeek: number[];
  intervalWeeks?: number;
  until?: string;
};

type CalendarRecurrenceCycleItem = {
  label: string;
  days?: number;
  color?: string;
};

type CalendarRecurrenceCycle = {
  type: "cycle";
  pattern: CalendarRecurrenceCycleItem[];
  until?: string;
};

type CalendarRecurrenceYearly = {
  type: "yearly";
  intervalYears?: number;
  until?: string;
  calendar?: "solar" | "lunar";
  lunarYear?: number;
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
};

type CalendarRecurrence =
  | CalendarRecurrenceWeekly
  | CalendarRecurrenceCycle
  | CalendarRecurrenceYearly;

type CalendarEvent = WidgetDataBase & {
  title: string;
  startAt: ISODate;
  endAt?: ISODate;
  allDay?: boolean;
  location?: string;
  description?: string;
  color?: string;
  recurrence?: CalendarRecurrence;
};

type WeatherCache = {
  id: string;
  widgetId: string;
  dashboardId: string;
  locationKey: string;
  payload: unknown;
  fetchedAt: ISODate;
};

type SnapshotWithoutPhotos = {
  dashboards: Dashboard[];
  widgets: Widget[];
  memos: Memo[];
  todos: Todo[];
  ddays: Dday[];
  moods: Mood[];
  notices: Notice[];
  metrics: Metric[];
  metricEntries: MetricEntry[];
  calendarEvents: CalendarEvent[];
  weatherCache: WeatherCache[];
};

// type ImportRequestBody =
//   | { userId: string; snapshot: SnapshotWithoutPhotos }
//   // 편의: snapshot 래핑 없이 바로 보내는 것도 허용 (userId는 헤더로)
//   | SnapshotWithoutPhotos;

/** =========
 *  Helpers (type guards)
 *  ========= */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function hasKeys<T extends string>(obj: Record<string, unknown>, keys: readonly T[]): obj is Record<T, unknown> {
  return keys.every((k) => k in obj);
}

/** ISODate는 "문자열" 정도만 최소검증 (빡세게 하면 오탐이 생김) */
function isISODate(v: unknown): v is ISODate {
  return isString(v) && v.length >= 10; // 최소한의 sanity check
}

/** WidgetLayout */
function isWidgetLayout(v: unknown): v is WidgetLayout {
  if (!isRecord(v)) return false;
  if (!isNumber(v.x) || !isNumber(v.y) || !isNumber(v.w) || !isNumber(v.h)) return false;

  // optional numeric/bool fields
  const optionalNumbers: (keyof Pick<WidgetLayout, "minW" | "minH" | "maxW" | "maxH">)[] = ["minW", "minH", "maxW", "maxH"];
  for (const k of optionalNumbers) {
    const val = v[k as string];
    if (val !== undefined && !isNumber(val)) return false;
  }
  const st = v.static;
  if (st !== undefined && !isBoolean(st)) return false;

  return true;
}

/** Dashboard */
function isDashboard(v: unknown): v is Dashboard {
  if (!isRecord(v)) return false;
  if (!hasKeys(v, ["id", "name", "createdAt", "updatedAt"])) return false;
  if (!isString(v.id) || !isString(v.name)) return false;
  if (!isISODate(v.createdAt) || !isISODate(v.updatedAt)) return false;

  const ownerId = v.ownerId;
  if (ownerId !== undefined && !isString(ownerId)) return false;
  const groupId = v.groupId;
  if (groupId !== undefined && !isString(groupId)) return false;

  return true;
}

/** WidgetType */
function isWidgetType(v: unknown): v is WidgetType {
  return (
    v === "calendar" ||
    v === "memo" ||
    v === "photo" ||
    v === "todo" ||
    v === "dday" ||
    v === "chart" ||
    v === "notice" ||
    v === "mood" ||
    v === "weather"
  );
}

/** Widget */
function isWidget(v: unknown): v is Widget {
  if (!isRecord(v)) return false;
  if (!hasKeys(v, ["id", "dashboardId", "type", "layout", "createdAt", "updatedAt"])) return false;
  if (!isString(v.id) || !isString(v.dashboardId) || !isWidgetType(v.type)) return false;
  if (!isWidgetLayout(v.layout)) return false;
  if (!isISODate(v.createdAt) || !isISODate(v.updatedAt)) return false;

  const createdBy = v.createdBy;
  if (createdBy !== undefined && !isString(createdBy)) return false;

  // settings는 object면 OK (array도 object이긴 한데, settings를 array로 쓰진 않으니 막자)
  const settings = v.settings;
  if (settings !== undefined) {
    if (!isRecord(settings)) return false;
  }
  return true;
}

/** WidgetDataBase */
function isWidgetDataBase(v: unknown): v is WidgetDataBase {
  if (!isRecord(v)) return false;
  if (!hasKeys(v, ["id", "widgetId", "dashboardId", "createdAt", "updatedAt"])) return false;
  if (!isString(v.id) || !isString(v.widgetId) || !isString(v.dashboardId)) return false;
  if (!isISODate(v.createdAt) || !isISODate(v.updatedAt)) return false;
  return true;
}

/** Memo */
function isMemo(v: unknown): v is Memo {
  if (!isWidgetDataBase(v)) return false;
  if (!("text" in v) || !isString(v.text)) return false;
  const color = (v as Record<string, unknown>).color;
  if (color !== undefined && !isString(color)) return false;
  return true;
}

/** Todo */
function isTodo(v: unknown): v is Todo {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.date) || !isString(r.title) || !isBoolean(r.done)) return false;
  if (r.order !== undefined && !isNumber(r.order)) return false;
  return true;
}

/** Dday */
function isDday(v: unknown): v is Dday {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.title) || !isString(r.date)) return false;
  if (r.color !== undefined && !isString(r.color)) return false;
  return true;
}

/** Mood */
function isMood(v: unknown): v is Mood {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.date)) return false;

  const mood = r.mood;
  const ok =
    mood === "great" || mood === "good" || mood === "ok" || mood === "bad" || mood === "awful";
  if (!ok) return false;

  const note = r.note;
  if (note !== undefined && !isString(note)) return false;
  return true;
}

/** Notice */
function isNotice(v: unknown): v is Notice {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.title) || !isString(r.body)) return false;
  if (r.pinned !== undefined && !isBoolean(r.pinned)) return false;
  return true;
}

/** Metric */
function isMetric(v: unknown): v is Metric {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.name)) return false;
  if (r.unit !== undefined && !isString(r.unit)) return false;
  const ct = r.chartType;
  if (ct !== undefined && ct !== "line" && ct !== "bar") return false;
  return true;
}

/** MetricEntry */
function isMetricEntry(v: unknown): v is MetricEntry {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.metricId) || !isString(r.date) || !isNumber(r.value)) return false;
  return true;
}

function isCalendarRecurrence(v: unknown): v is CalendarRecurrence {
  if (!isRecord(v)) return false;
  const type = v.type;
  if (type === "weekly") {
    if (!isArray(v.daysOfWeek) || !v.daysOfWeek.every(isNumber)) return false;
    if (v.intervalWeeks !== undefined && !isNumber(v.intervalWeeks)) return false;
    if (v.until !== undefined && !isString(v.until)) return false;
    return true;
  }
  if (type === "cycle") {
    if (!isArray(v.pattern)) return false;
    for (const item of v.pattern) {
      if (!isRecord(item)) return false;
      if (!isString(item.label)) return false;
      if (item.days !== undefined && !isNumber(item.days)) return false;
      if (item.color !== undefined && !isString(item.color)) return false;
      if (item.isGap !== undefined && !isBoolean(item.isGap)) return false;
    }
    if (v.until !== undefined && !isString(v.until)) return false;
    return true;
  }
  if (type === "yearly") {
    if (v.intervalYears !== undefined && !isNumber(v.intervalYears)) return false;
    if (v.until !== undefined && !isString(v.until)) return false;
    if (v.calendar !== undefined && v.calendar !== "solar" && v.calendar !== "lunar") {
      return false;
    }
    if (v.lunarYear !== undefined && !isNumber(v.lunarYear)) return false;
    if (v.lunarMonth !== undefined && !isNumber(v.lunarMonth)) return false;
    if (v.lunarDay !== undefined && !isNumber(v.lunarDay)) return false;
    if (v.lunarLeapMonth !== undefined && !isBoolean(v.lunarLeapMonth)) return false;
    return true;
  }
  return false;
}

/** CalendarEvent */
function isCalendarEvent(v: unknown): v is CalendarEvent {
  if (!isWidgetDataBase(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isString(r.title) || !isISODate(r.startAt)) return false;
  if (r.endAt !== undefined && !isISODate(r.endAt)) return false;
  if (r.allDay !== undefined && !isBoolean(r.allDay)) return false;
  if (r.location !== undefined && !isString(r.location)) return false;
  if (r.description !== undefined && !isString(r.description)) return false;
  if (r.color !== undefined && !isString(r.color)) return false;
  if (r.recurrence !== undefined && !isCalendarRecurrence(r.recurrence)) {
    return false;
  }
  return true;
}

/** WeatherCache */
function isWeatherCache(v: unknown): v is WeatherCache {
  if (!isRecord(v)) return false;
  if (!hasKeys(v, ["id", "widgetId", "dashboardId", "locationKey", "payload", "fetchedAt"])) return false;
  if (!isString(v.id) || !isString(v.widgetId) || !isString(v.dashboardId) || !isString(v.locationKey)) return false;
  if (!isISODate(v.fetchedAt)) return false;
  // payload는 unknown 그대로 둠
  return true;
}

function isSnapshotWithoutPhotos(v: unknown): v is SnapshotWithoutPhotos {
  if (!isRecord(v)) return false;

  const keys: (keyof SnapshotWithoutPhotos)[] = [
    "dashboards",
    "widgets",
    "memos",
    "todos",
    "ddays",
    "moods",
    "notices",
    "metrics",
    "metricEntries",
    "calendarEvents",
    "weatherCache",
  ];

  if (!keys.every((k) => k in v)) return false;

  const d = v.dashboards;
  const w = v.widgets;
  const memos = v.memos;
  const todos = v.todos;
  const ddays = v.ddays;
  const moods = v.moods;
  const notices = v.notices;
  const metrics = v.metrics;
  const metricEntries = v.metricEntries;
  const calendarEvents = v.calendarEvents;
  const weatherCache = v.weatherCache;

  if (!isArray(d) || !d.every(isDashboard)) return false;
  if (!isArray(w) || !w.every(isWidget)) return false;
  if (!isArray(memos) || !memos.every(isMemo)) return false;
  if (!isArray(todos) || !todos.every(isTodo)) return false;
  if (!isArray(ddays) || !ddays.every(isDday)) return false;
  if (!isArray(moods) || !moods.every(isMood)) return false;
  if (!isArray(notices) || !notices.every(isNotice)) return false;
  if (!isArray(metrics) || !metrics.every(isMetric)) return false;
  if (!isArray(metricEntries) || !metricEntries.every(isMetricEntry)) return false;
  if (!isArray(calendarEvents) || !calendarEvents.every(isCalendarEvent)) return false;
  if (!isArray(weatherCache) || !weatherCache.every(isWeatherCache)) return false;

  return true;
}

type ParsedImport = {
  snapshot: SnapshotWithoutPhotos;
};

function parseImportBody(body: unknown): ParsedImport | null {
  // 케이스 1) { snapshot } (legacy { userId, snapshot }도 허용)
  if (isRecord(body) && "snapshot" in body) {
    const snapshot = body.snapshot;
    if (!isSnapshotWithoutPhotos(snapshot)) return null;
    return { snapshot };
  }

  // 케이스 2) snapshot만 통째로
  if (isSnapshotWithoutPhotos(body)) {
    return { snapshot: body };
  }

  return null;
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

type StagingPruneOptions = {
  retentionMs: number;
  maxFiles: number;
};

async function pruneStagedSnapshots(userDir: string, options: StagingPruneOptions) {
  const entries = await fs.readdir(userDir, { withFileTypes: true });
  const files: { path: string; mtimeMs: number }[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith("snapshot-") || !entry.name.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(userDir, entry.name);
    try {
      const stat = await fs.stat(filePath);
      files.push({ path: filePath, mtimeMs: stat.mtimeMs });
    } catch {
      // Ignore per-file stat errors.
    }
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const expireBefore = Date.now() - options.retentionMs;

  await Promise.all(
    files.map((file, index) => {
      const overLimit = index >= options.maxFiles;
      const expired = file.mtimeMs < expireBefore;
      if (!overLimit && !expired) {
        return Promise.resolve();
      }
      return fs.unlink(file.path).catch(() => {
        // Ignore per-file delete errors.
      });
    })
  );
}

async function stageSnapshotToDisk(params: {
  userId: string;
  snapshot: SnapshotWithoutPhotos;
  prune: StagingPruneOptions;
}) {
  const baseDir =
    process.env.MIGRATION_STAGING_DIR ??
    path.join(process.cwd(), "data", "migration-staging");

  const safeUserId = sanitizePathSegment(params.userId);
  const userDir = path.join(baseDir, safeUserId);
  await ensureDir(userDir);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(userDir, `snapshot-${ts}.json`);

  await fs.writeFile(filePath, JSON.stringify(params.snapshot, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  await pruneStagedSnapshots(userDir, params.prune).catch(() => {
    // Ignore staging prune errors to avoid blocking import.
  });
  return path.relative(baseDir, filePath);
}

function countSnapshotRecords(snapshot: SnapshotWithoutPhotos) {
  return (
    snapshot.dashboards.length +
    snapshot.widgets.length +
    snapshot.memos.length +
    snapshot.todos.length +
    snapshot.ddays.length +
    snapshot.moods.length +
    snapshot.notices.length +
    snapshot.metrics.length +
    snapshot.metricEntries.length +
    snapshot.calendarEvents.length +
    snapshot.weatherCache.length
  );
}

function hasValidImportToken(request: Request, expectedToken: string) {
  const providedToken =
    request.headers.get("x-migration-import-token")?.trim() ?? "";

  const expectedBuffer = Buffer.from(expectedToken);
  const providedBuffer = Buffer.from(providedToken);

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/** =========
 *  Route
 *  ========= */
export async function POST(request: Request) {
  if (process.env.ENABLE_MIGRATION_IMPORT !== "true") {
    return jsonError(404, "Not found");
  }
  const importToken = process.env.MIGRATION_IMPORT_TOKEN?.trim() ?? "";
  if (!importToken) {
    return jsonError(503, "Migration import is not configured");
  }
  if (!hasValidImportToken(request, importToken)) {
    return jsonError(403, "Forbidden");
  }

  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { userId } = userResult.context;

  const rateLimit = await enforceRateLimit({
    key: `migrate-import:${userId}`,
    limit: parsePositiveIntEnv(process.env.MIGRATION_IMPORT_RATE_LIMIT, 5),
    windowMs: parsePositiveIntEnv(
      process.env.MIGRATION_IMPORT_RATE_WINDOW_MS,
      10 * 60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const maxBytes = parsePositiveIntEnv(
    process.env.MIGRATION_IMPORT_MAX_BYTES,
    5 * 1024 * 1024
  );

  const parsedBody = await parseJson(request, { maxBytes });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const parsed = parseImportBody(body);
  if (!parsed) {
    return jsonError(400, "Invalid request body", {
      hint: "Send { snapshot } or send snapshot directly",
    });
  }

  const { snapshot } = parsed;
  const maxRecords = parsePositiveIntEnv(
    process.env.MIGRATION_IMPORT_MAX_RECORDS,
    20000
  );
  const recordCount = countSnapshotRecords(snapshot);
  if (recordCount > maxRecords) {
    return jsonError(413, "Too many records", { maxRecords });
  }

  const stagingRetentionDays = parsePositiveIntEnv(
    process.env.MIGRATION_STAGING_RETENTION_DAYS,
    7
  );
  const maxStagingFiles = parsePositiveIntEnv(
    process.env.MIGRATION_STAGING_MAX_FILES_PER_USER,
    30
  );

  // ✅ 지금 단계: 디스크 스테이징 저장
  const stagedPath = await stageSnapshotToDisk({
    userId,
    snapshot,
    prune: {
      retentionMs: stagingRetentionDays * 24 * 60 * 60 * 1000,
      maxFiles: maxStagingFiles,
    },
  });

  return NextResponse.json({
    ok: true,
    stagedPath,
    counts: {
      dashboards: snapshot.dashboards.length,
      widgets: snapshot.widgets.length,
      memos: snapshot.memos.length,
      todos: snapshot.todos.length,
      ddays: snapshot.ddays.length,
      moods: snapshot.moods.length,
      notices: snapshot.notices.length,
      metrics: snapshot.metrics.length,
      metricEntries: snapshot.metricEntries.length,
      calendarEvents: snapshot.calendarEvents.length,
      weatherCache: snapshot.weatherCache.length,
    },
  });
}
