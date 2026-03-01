// src/db/schema.ts
// Migration-friendly schema (Local-only mode + Snapshot migration)
//
// 핵심 원칙
// - Shared Domain Types: 서버(Postgres)에도 그대로 넣기 쉬운 정본 구조
// - Local-only 확장: 사진만 Blob을 로컬에 저장(LocalPhoto)
// - outbox(변경 로그)를 추가해서 서버 동기화용 이벤트 큐를 유지한다.
// - migrationState 테이블로 "이 로컬 프로필이 어떤 계정으로 마이그레이션 되었는지"를 관리한다.

export type Id = string; // crypto.randomUUID() 사용 추천
export type ISODate = string; // new Date().toISOString()
export type YMD = string; // "YYYY-MM-DD"
export type WidgetType =
  | "calendar"
  | "memo"
  | "photo"
  | "todo"
  | "dday"
  | "chart"
  | "notice"
  | "mood"
  | "weather";

export type Role = "parent" | "child";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

/** 대시보드(정본) */
export interface Dashboard {
  id: Id;
  name: string;
  ownerId?: Id;
  groupId?: Id;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 배치된 위젯 메타(정본) */
export interface Widget {
  id: Id;
  dashboardId: Id;
  type: WidgetType;
  layout: WidgetLayout;
  settings?: Record<string, unknown>;
  createdBy?: Id;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 위젯 데이터 공통 베이스(정본) */
export interface WidgetDataBase {
  id: Id;
  widgetId: Id;
  dashboardId: Id;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 메모 */
export interface Memo extends WidgetDataBase {
  text: string;
  color?: string;
}

/** Todo (날짜별) */
export interface Todo extends WidgetDataBase {
  date: YMD;
  title: string;
  done: boolean;
  order?: number;
}

/** D-day */
export interface Dday extends WidgetDataBase {
  title: string;
  date: YMD;
  color?: string;
}

/**
 * Photo(정본)
 * - 서버(Postgres) 기준 정본은 "storagePath" (노트북 디스크 상대경로)
 * - 로컬에서는 LocalPhoto가 Blob을 가진다.
 */
export interface Photo extends WidgetDataBase {
  storagePath: string;
  mimeType: string;
  caption?: string;
  takenAt?: ISODate;
}

/** 로컬 전용 사진(IndexedDB에 Blob 저장) */
export interface LocalPhoto extends Omit<Photo, "storagePath"> {
  blob?: Blob;
  /** 로그인 후 업로드가 끝나서 서버 경로를 받았다면 저장해둘 수 있음(선택) */
  serverStoragePath?: string;
}

/** 기분 */
export interface Mood extends WidgetDataBase {
  date: YMD;
  mood: "great" | "good" | "ok" | "bad" | "awful";
  note?: string;
}

/** 공지 */
export interface Notice extends WidgetDataBase {
  title: string;
  body: string;
  pinned?: boolean;
}

/** 차트: 지표 정의 */
export interface Metric extends WidgetDataBase {
  name: string;
  unit?: string;
  chartType?: "line" | "bar";
}

/** 차트: 날짜별 기록 */
export interface MetricEntry extends WidgetDataBase {
  metricId: Id;
  date: YMD;
  value: number;
}

/** 캘린더 이벤트(단순) */
export type CalendarRecurrenceWeekly = {
  type: "weekly";
  daysOfWeek: number[];
  intervalWeeks?: number;
  until?: YMD;
};

export type CalendarRecurrenceCycleItem = {
  label: string;
  days?: number;
  color?: string;
  isGap?: boolean;
};

export type CalendarRecurrenceCycle = {
  type: "cycle";
  pattern: CalendarRecurrenceCycleItem[];
  until?: YMD;
};

export type CalendarRecurrenceYearly = {
  type: "yearly";
  intervalYears?: number;
  until?: YMD;
  calendar?: "solar" | "lunar";
  lunarYear?: number;
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
};

export type CalendarRecurrence =
  | CalendarRecurrenceWeekly
  | CalendarRecurrenceCycle
  | CalendarRecurrenceYearly;

export interface CalendarEvent extends WidgetDataBase {
  title: string;
  startAt: ISODate;
  endAt?: ISODate;
  allDay?: boolean;
  location?: string;
  description?: string;
  color?: string;
  recurrence?: CalendarRecurrence;
}

/** 날씨 캐시(선택 저장) */
export interface WeatherCache {
  id: Id;
  widgetId: Id;
  dashboardId: Id;
  locationKey: string;
  payload: unknown;
  fetchedAt: ISODate;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

/** (로그인/공유 이후) 멤버 캐시(선택) */
export interface Member {
  id: Id;
  groupId: Id;
  role: Role;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  userId?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** outbox 이벤트(서버 동기화용 큐) */
export type OutboxOperation = "upsert" | "delete";
export type OutboxEntityType =
  | "dashboard"
  | "widget"
  | "memo"
  | "todo"
  | "dday"
  | "localPhoto"
  | "photo"
  | "mood"
  | "notice"
  | "metric"
  | "metricEntry"
  | "calendarEvent"
  | "weatherCache";

export interface OutboxEvent {
  id: string; // `${entityType}:${entityId}`
  entityType: OutboxEntityType;
  entityId: Id;
  dashboardId?: Id;
  widgetId?: Id;
  operation: OutboxOperation;
  payload?: Record<string, unknown>;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/**
 * 마이그레이션 상태 (outbox 대신 이것만!)
 * - "이 로컬 프로필의 데이터가 어떤 계정으로 한 번이라도 올라갔는지" 표시용
 */
export interface MigrationState {
  id: string; // localProfileId (브라우저별 고유값)
  status: "idle" | "migrating" | "done" | "failed";
  migratedToUserId?: string;
  migratedAt?: ISODate;
  lastError?: string;
  updatedAt: ISODate;
}

/**
 * 로그인 시 서버로 올릴 "스냅샷" 형태
 * - photo는 Blob 업로드가 필요하므로 localPhotos는 별도로 포함
 *   (서버로 보낼 때: localPhotos를 먼저 업로드 → Photo(storagePath 포함)로 변환해 import)
 */
export interface LocalSnapshot {
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

  // 로컬 전용(Blob)
  localPhotos: LocalPhoto[];

  // 선택 캐시
  members: Member[];
}
