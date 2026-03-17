import { Prisma } from "@prisma/client";
import { expandCalendarEvents } from "@/feature/widgets/Calendar/libs/calendarUtils";
import { parseOpenMeteoDaily } from "@/feature/widgets/Weather/libs/openMeteo";
import prisma from "@/server/prisma";
import { generateTextWithGemini } from "@/server/gemini";
import type {
  CalendarEvent as SharedCalendarEvent,
  CalendarRecurrence,
} from "@/shared/db/schema";
import type { AppLanguage } from "@/shared/i18n/language";

const SUMMARY_VERSION = 3;
const SUMMARY_DEBUG_ENABLED = process.env.DEBUG_GEMINI_SUMMARY === "1";
const RULE_BASED_SUMMARY_MODEL = "rule-based-fallback";
const MIN_SUMMARY_BOUNDARY_OFFSET_MS = -14 * 60 * 60 * 1000;
const MAX_SUMMARY_BOUNDARY_OFFSET_MS = 12 * 60 * 60 * 1000;
const MAX_SUMMARY_BOUNDARY_OFFSET_DRIFT_MS = 2 * 60 * 60 * 1000;
const SUMMARY_BOUNDARY_GRANULARITY_MS = 15 * 60 * 1000;

type SummaryStats = {
  summaryVersion: number;
  windowStartYmd: string;
  windowEndYmd: string;
  todoTotal: number;
  todoDone: number;
  todoPending: number;
  moodCounts: Record<string, number>;
  memoCount: number;
  eventCount: number;
  metricEntryCount: number;
  ddayCount: number;
  photoCount: number;
  noticeCount: number;
  weatherSnapshotCount: number;
  todos: Array<{ date: string; title: string; done: boolean }>;
  moods: Array<{ date: string; mood: string; note?: string }>;
  memos: Array<{ updatedAt: string; text: string }>;
  events: Array<{
    title: string;
    startAt: string;
    endAt?: string;
    allDay: boolean;
    location?: string;
    description?: string;
  }>;
  metricEntries: Array<{
    metric: string;
    unit?: string;
    date: string;
    value: number;
  }>;
  ddays: Array<{ date: string; title: string }>;
  photos: Array<{ takenAt?: string; createdAt: string; caption?: string }>;
  notices: Array<{ title: string; body: string; pinned: boolean }>;
  weatherSnapshots: Array<{
    ymd: string;
    locationKey: string;
    fetchedAt: string;
    condition: string;
    tempMin: number | null;
    tempMax: number | null;
  }>;
};

type WeeklySummaryResult = {
  status: "ready" | "pending" | "failed";
  windowStartYmd: string;
  windowEndYmd: string;
  generatedAt?: string;
  summary?: string;
  stats?: SummaryStats;
  error?: string;
  model?: string;
};

type SummaryInput = {
  widgetId: string;
  dashboardId: string;
  windowStartYmd: string;
  windowEndYmd: string;
  windowStartAt: string;
  windowEndAt: string;
  startAt: Date;
  endAt: Date;
  language: AppLanguage;
};

type GeneratedSummary = {
  model: string;
  summary: string;
};

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoBoundary(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseYmdBoundaryUtc(ymd: string) {
  if (!isYmd(ymd)) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== ymd) return null;
  return date;
}

function isValidSummaryBoundaryOffset(offsetMs: number) {
  return (
    offsetMs >= MIN_SUMMARY_BOUNDARY_OFFSET_MS &&
    offsetMs <= MAX_SUMMARY_BOUNDARY_OFFSET_MS &&
    Math.abs(offsetMs % SUMMARY_BOUNDARY_GRANULARITY_MS) === 0
  );
}

function normalizeText(value: string | null | undefined, maxLength = 120) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSummaryDataBundle(stats: SummaryStats) {
  return JSON.stringify(stats, null, 2);
}

function debugSummary(event: string, payload: Record<string, unknown>) {
  if (!SUMMARY_DEBUG_ENABLED) return;
  console.log(`[weekly-summary] ${event}`, payload);
}

function describeWeatherCode(code: number | null) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code !== null) {
    if (code >= 51 && code <= 67) return "rain";
    if (code >= 71 && code <= 77) return "snow";
    if (code >= 80 && code <= 82) return "shower";
    if (code >= 85 && code <= 86) return "snow";
    if (code >= 95 && code <= 99) return "thunderstorm";
  }
  return "cloud";
}

function hasBalancedDelimiters(value: string) {
  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  return pairs.every(([open, close]) => {
    const opens = value.split(open).length - 1;
    const closes = value.split(close).length - 1;
    return opens === closes;
  });
}

function isLikelyCompleteSummary(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 60) return false;
  if (!hasBalancedDelimiters(trimmed)) return false;
  if (/[([{:'"`-]$/.test(trimmed)) return false;
  if (/[.!?。！？]$/.test(trimmed)) return true;
  return /(다|요|죠|네요|습니다|했다|했다요|였어요|였습니다|이다|입니다)$/.test(
    trimmed,
  );
}

function hasExpandedSummaryStats(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const stats = value as Record<string, unknown>;
  return (
    stats.summaryVersion === SUMMARY_VERSION &&
    typeof stats.todoTotal === "number" &&
    typeof stats.ddayCount === "number" &&
    typeof stats.photoCount === "number" &&
    typeof stats.noticeCount === "number" &&
    Array.isArray(stats.events)
  );
}

async function generateSummaryText(
  stats: SummaryStats,
  language: AppLanguage,
): Promise<GeneratedSummary> {
  const dataBundle = buildSummaryDataBundle(stats);
  const promptBase = [
    "You are summarizing the last 7 days of a personal dashboard.",
    `Write the summary in ${language === "ko" ? "natural Korean" : "natural English"}.`,
    "Return only the final summary text.",
    "Do not use JSON.",
    "Do not use markdown fences.",
    "Write exactly 3 complete sentences ready to show directly to the user.",
    "Every sentence must end with proper punctuation.",
    "Do not stop mid-sentence.",
    "Use only the data bundle below.",
    "Read across every provided section and summarize the whole week naturally.",
    "Recurring routine schedules such as shift rotations are lower priority in the summary.",
    "Focus more on special or notable events whenever they exist.",
    "Use concrete details when they help, but do not invent missing facts.",
    dataBundle,
    "Speak in a warm tone.",
    "End with a short encouraging message.",
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = [
      ...promptBase,
      attempt === 0
        ? ""
        : "Your previous answer was incomplete. Return exactly 3 complete sentences and do not stop mid-sentence.",
    ]
      .filter(Boolean)
      .join("\n");

    let generated: Awaited<ReturnType<typeof generateTextWithGemini>>;
    try {
      generated = await generateTextWithGemini({
        prompt,
        model: attempt === 0 ? undefined : "gemini-flash-latest",
        maxOutputTokens: 768,
        temperature: attempt === 0 ? 0.2 : 0,
        thinkingMode: "minimize",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Missing GEMINI_API_KEY"
      ) {
        return buildFallbackSummary(stats, language);
      }
      throw error;
    }
    const summary = generated.text.trim();
    debugSummary("attempt", {
      attempt: attempt + 1,
      language,
      model: generated.model,
      prompt:prompt,
      promptLength: prompt.length,
      summaryLength: summary.length,
      summaryPreview: summary.slice(0, 200),
    });
    if (!summary) {
      continue;
    }
    if (!isLikelyCompleteSummary(summary)) {
      debugSummary("incomplete", {
        attempt: attempt + 1,
        language,
        model: generated.model,
        summaryLength: summary.length,
        summaryPreview: summary.slice(0, 200),
      });
      if (attempt === 1) {
        throw new Error("Gemini returned an incomplete summary");
      }
      continue;
    }

    return {
      model: generated.model,
      summary,
    };
  }
  throw new Error("Gemini returned an empty summary");
}

function buildFallbackSummary(
  stats: SummaryStats,
  language: AppLanguage,
): GeneratedSummary {
  const topMood = Object.entries(stats.moodCounts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  })[0];

  if (language === "ko") {
    const extraHighlights = [
      stats.photoCount > 0 ? `사진 ${stats.photoCount}장` : "",
      stats.metricEntryCount > 0 ? `지표 기록 ${stats.metricEntryCount}건` : "",
      stats.ddayCount > 0 ? `디데이 ${stats.ddayCount}개` : "",
      stats.noticeCount > 0 ? `공지 ${stats.noticeCount}개` : "",
    ].filter(Boolean);
    const extraSentence = topMood
      ? extraHighlights.length > 0
        ? `기분 기록으로는 ${topMood[0]}가 ${topMood[1]}번으로 가장 많았고 ${extraHighlights
            .slice(0, 2)
            .join(", ")}도 함께 남아 있어요.`
        : `기분 기록으로는 ${topMood[0]}가 ${topMood[1]}번으로 가장 많았어요.`
      : extraHighlights.length > 0
        ? `${extraHighlights.slice(0, 2).join(", ")}이 이번 주의 흔적으로 남아 있어요.`
        : "눈에 띄는 추가 기록은 많지 않았지만 한 주의 흐름은 차분히 남아 있어요.";

    return {
      model: RULE_BASED_SUMMARY_MODEL,
      summary: [
        `지난 7일 동안 할 일 ${stats.todoTotal}개 중 ${stats.todoDone}개를 마쳤고 일정 ${stats.eventCount}개와 메모 ${stats.memoCount}개가 기록됐어요.`,
        extraSentence,
        stats.todoPending > 0
          ? `남은 할 일 ${stats.todoPending}개도 다음 주에 하나씩 정리해 보세요.`
          : "지금의 흐름을 이어서 다음 주도 차분하게 쌓아가 보세요.",
      ].join(" "),
    };
  }

  const extraHighlights = [
    stats.photoCount > 0
      ? `${stats.photoCount} photo${stats.photoCount === 1 ? "" : "s"}`
      : "",
    stats.metricEntryCount > 0
      ? `${stats.metricEntryCount} metric entr${stats.metricEntryCount === 1 ? "y" : "ies"}`
      : "",
    stats.ddayCount > 0
      ? `${stats.ddayCount} D-day reminder${stats.ddayCount === 1 ? "" : "s"}`
      : "",
    stats.noticeCount > 0
      ? `${stats.noticeCount} notice${stats.noticeCount === 1 ? "" : "s"}`
      : "",
  ].filter(Boolean);
  const extraSentence = topMood
    ? extraHighlights.length > 0
      ? `The most common mood was ${topMood[0]} at ${topMood[1]} entr${topMood[1] === 1 ? "y" : "ies"}, and ${extraHighlights
          .slice(0, 2)
          .join(", ")} also stood out.`
      : `The most common mood was ${topMood[0]} at ${topMood[1]} entr${topMood[1] === 1 ? "y" : "ies"}.`
    : extraHighlights.length > 0
      ? `${extraHighlights.slice(0, 2).join(", ")} also added context to the week.`
      : "There was not much extra activity, but the week's overall rhythm is still visible.";

  return {
    model: RULE_BASED_SUMMARY_MODEL,
    summary: [
      `Over the last 7 days, ${stats.todoDone} of ${stats.todoTotal} todos were completed, with ${stats.eventCount} events and ${stats.memoCount} memos recorded.`,
      extraSentence,
      stats.todoPending > 0
        ? `You still have ${stats.todoPending} open todo${stats.todoPending === 1 ? "" : "s"}, so next week has a clear starting point.`
        : "You closed the week with a clean slate, so carry that pace into the next one.",
    ].join(" "),
  };
}

async function acquireSummaryLock(widgetId: string, windowStartYmd: string) {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>(
    Prisma.sql`
      SELECT pg_try_advisory_lock(hashtext(${widgetId}), hashtext(${windowStartYmd})) AS locked
    `,
  );
  return Boolean(rows[0]?.locked);
}

async function releaseSummaryLock(widgetId: string, windowStartYmd: string) {
  await prisma.$queryRaw(
    Prisma.sql`
      SELECT pg_advisory_unlock(hashtext(${widgetId}), hashtext(${windowStartYmd}))
    `,
  );
}

function mapSummaryRecord(
  record: {
    status: string;
    summaryKo: string | null;
    summaryEn: string | null;
    stats: Prisma.JsonValue;
    generatedAt: Date | null;
    error: string | null;
    model: string | null;
    windowStartYmd: string;
    windowEndYmd: string;
  },
  language: AppLanguage,
): WeeklySummaryResult {
  const status =
    record.status === "ready" || record.status === "failed"
      ? record.status
      : "pending";

  return {
    status,
    summary:
      status === "ready"
        ? ((language === "ko" ? record.summaryKo : record.summaryEn) ??
          undefined)
        : undefined,
    stats:
      status === "ready" && record.stats && typeof record.stats === "object"
        ? (record.stats as unknown as SummaryStats)
        : undefined,
    generatedAt:
      status === "ready" ? record.generatedAt?.toISOString() : undefined,
    error: record.error ?? undefined,
    model: status === "ready" ? (record.model ?? undefined) : undefined,
    windowStartYmd: record.windowStartYmd,
    windowEndYmd: record.windowEndYmd,
  };
}

function hasRequestedSummary(
  record: { summaryKo: string | null; summaryEn: string | null },
  language: AppLanguage,
) {
  const value = language === "ko" ? record.summaryKo : record.summaryEn;
  return typeof value === "string" && value.trim().length > 0;
}

function canReuseSummaryRecord(
  record: {
    status: string;
    summaryKo: string | null;
    summaryEn: string | null;
    stats: Prisma.JsonValue;
  },
  language: AppLanguage,
) {
  return (
    record.status === "ready" &&
    hasRequestedSummary(record, language) &&
    hasExpandedSummaryStats(record.stats)
  );
}

export function validateSummaryWindow(input: {
  windowStartYmd: string;
  windowEndYmd: string;
  windowStartAt: string;
  windowEndAt: string;
}) {
  const startDate = parseYmdBoundaryUtc(input.windowStartYmd);
  const endDate = parseYmdBoundaryUtc(input.windowEndYmd);
  const startAt = parseIsoBoundary(input.windowStartAt);
  const endAt = parseIsoBoundary(input.windowEndAt);
  if (!startDate || !endDate || !startAt || !endAt) return null;

  const diffDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays !== 7) return null;
  if (endAt.getTime() <= startAt.getTime()) return null;

  const startOffsetMs = startAt.getTime() - startDate.getTime();
  const endOffsetMs = endAt.getTime() - endDate.getTime();
  if (!isValidSummaryBoundaryOffset(startOffsetMs)) return null;
  if (!isValidSummaryBoundaryOffset(endOffsetMs)) return null;
  if (
    Math.abs(endOffsetMs - startOffsetMs) >
    MAX_SUMMARY_BOUNDARY_OFFSET_DRIFT_MS
  ) {
    return null;
  }

  return {
    ...input,
    startAt,
    endAt,
  };
}

export async function getOrCreateWeeklySummary(input: SummaryInput) {
  const summaryField = input.language === "ko" ? "summaryKo" : "summaryEn";
  const uniqueWhere = {
    widgetId_windowStartYmd: {
      widgetId: input.widgetId,
      windowStartYmd: input.windowStartYmd,
    },
  } as const;

  const existing = await prisma.weeklySummary.findUnique({
    where: uniqueWhere,
  });
  if (existing && canReuseSummaryRecord(existing, input.language)) {
    return mapSummaryRecord(existing, input.language);
  }

  const locked = await acquireSummaryLock(input.widgetId, input.windowStartYmd);
  if (!locked) {
    const current = await prisma.weeklySummary.findUnique({
      where: uniqueWhere,
    });
    if (current && canReuseSummaryRecord(current, input.language)) {
      return mapSummaryRecord(current, input.language);
    }

    return {
      status: "pending",
      windowStartYmd: input.windowStartYmd,
      windowEndYmd: input.windowEndYmd,
    };
  }

  try {
    const current = await prisma.weeklySummary.findUnique({
      where: uniqueWhere,
    });
    if (current && canReuseSummaryRecord(current, input.language)) {
      return mapSummaryRecord(current, input.language);
    }

    const hasCurrentVersion = current
      ? hasExpandedSummaryStats(current.stats)
      : false;
    if (!hasCurrentVersion) {
      await prisma.weeklySummary.upsert({
        where: uniqueWhere,
        update: {
          dashboardId: input.dashboardId,
          windowEndYmd: input.windowEndYmd,
          status: "pending",
          summaryKo: null,
          summaryEn: null,
          stats: Prisma.JsonNull,
          model: null,
          generatedAt: null,
          error: null,
        },
        create: {
          widgetId: input.widgetId,
          dashboardId: input.dashboardId,
          windowStartYmd: input.windowStartYmd,
          windowEndYmd: input.windowEndYmd,
          status: "pending",
        },
      });
    }

    const [
      todos,
      moods,
      memos,
      calendarEvents,
      metricEntries,
      ddays,
      photos,
      notices,
      weatherCaches,
    ] = await Promise.all([
      prisma.todo.findMany({
        where: {
          dashboardId: input.dashboardId,
          date: {
            gte: input.windowStartYmd,
            lt: input.windowEndYmd,
          },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.mood.findMany({
        where: {
          dashboardId: input.dashboardId,
          date: {
            gte: input.windowStartYmd,
            lt: input.windowEndYmd,
          },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.memo.findMany({
        where: {
          dashboardId: input.dashboardId,
          updatedAt: {
            gte: input.startAt,
            lt: input.endAt,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.calendarEvent.findMany({
        where: {
          dashboardId: input.dashboardId,
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.metricEntry.findMany({
        where: {
          dashboardId: input.dashboardId,
          date: {
            gte: input.windowStartYmd,
            lt: input.windowEndYmd,
          },
        },
        include: {
          metric: {
            select: {
              name: true,
              unit: true,
            },
          },
        },
        orderBy: [{ metricId: "asc" }, { date: "asc" }],
      }),
      prisma.dday.findMany({
        where: {
          dashboardId: input.dashboardId,
          OR: [
            {
              date: {
                gte: input.windowStartYmd,
                lt: input.windowEndYmd,
              },
            },
            {
              createdAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
            {
              updatedAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
          ],
        },
        orderBy: [{ date: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.photo.findMany({
        where: {
          dashboardId: input.dashboardId,
          OR: [
            {
              takenAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
            {
              createdAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
            {
              updatedAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
          ],
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.notice.findMany({
        where: {
          dashboardId: input.dashboardId,
          OR: [
            {
              createdAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
            {
              updatedAt: {
                gte: input.startAt,
                lt: input.endAt,
              },
            },
          ],
        },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.weatherCache.findMany({
        where: {
          dashboardId: input.dashboardId,
          fetchedAt: {
            lt: input.endAt,
          },
        },
        orderBy: { fetchedAt: "desc" },
      }),
    ]);

    const expandedEvents = expandCalendarEvents(
      calendarEvents.map(
        (event): SharedCalendarEvent => ({
          id: event.id,
          widgetId: event.widgetId,
          dashboardId: event.dashboardId,
          title: event.title,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt?.toISOString(),
          allDay: event.allDay ?? undefined,
          location: event.location ?? undefined,
          description: event.description ?? undefined,
          color: event.color ?? undefined,
          recurrence:
            event.recurrence &&
            typeof event.recurrence === "object" &&
            !Array.isArray(event.recurrence)
              ? (event.recurrence as unknown as CalendarRecurrence)
              : undefined,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        }),
      ),
      input.startAt,
      new Date(input.endAt.getTime() - 1),
    ).sort((a, b) => {
      const aTime = new Date(a.startAt).getTime();
      const bTime = new Date(b.startAt).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });

    const moodCounts = moods.reduce<Record<string, number>>((acc, mood) => {
      acc[mood.mood] = (acc[mood.mood] ?? 0) + 1;
      return acc;
    }, {});
    const weatherSnapshots = Array.from(
      weatherCaches
        .flatMap((cache) =>
          parseOpenMeteoDaily(cache.payload)
            .filter(
              (day) =>
                day.ymd >= input.windowStartYmd && day.ymd < input.windowEndYmd,
            )
            .map((day) => ({
              key: `${cache.locationKey}:${day.ymd}`,
              ymd: day.ymd,
              locationKey: cache.locationKey,
              fetchedAt: cache.fetchedAt.toISOString(),
              condition: describeWeatherCode(day.weatherCode),
              tempMin: day.tempMin,
              tempMax: day.tempMax,
            })),
        )
        .reduce(
          (map, item) => {
            if (!map.has(item.key)) {
              map.set(item.key, item);
            }
            return map;
          },
          new Map<
            string,
            {
              key: string;
              ymd: string;
              locationKey: string;
              fetchedAt: string;
              condition: string;
              tempMin: number | null;
              tempMax: number | null;
            }
          >(),
        )
        .values(),
    )
      .map(({ key: _key, ...item }) => item)
      .sort((a, b) => {
        const ymdDiff = a.ymd.localeCompare(b.ymd);
        if (ymdDiff !== 0) return ymdDiff;
        return a.locationKey.localeCompare(b.locationKey);
      });

    const normalizedTodos = todos.map((todo) => ({
      date: todo.date,
      title: normalizeText(todo.title, 120),
      done: todo.done,
    }));
    const normalizedMoods = moods.map((mood) => ({
      date: mood.date,
      mood: mood.mood,
      note: normalizeText(mood.note, 160) || undefined,
    }));
    const normalizedMemos = memos
      .map((memo) => ({
        updatedAt: memo.updatedAt.toISOString(),
        text: normalizeText(memo.text, 240),
      }))
      .filter((memo) => Boolean(memo.text));
    const normalizedEvents = expandedEvents.map((event) => ({
      title: normalizeText(event.title, 120),
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: Boolean(event.allDay),
      location: normalizeText(event.location, 120) || undefined,
      description: normalizeText(event.description, 240) || undefined,
    }));
    const normalizedMetricEntries = metricEntries.map((entry) => ({
      metric: normalizeText(entry.metric.name, 80),
      unit: normalizeText(entry.metric.unit, 20) || undefined,
      date: entry.date,
      value: entry.value,
    }));
    const normalizedDdays = ddays
      .map((dday) => ({
        date: dday.date,
        title: normalizeText(dday.title, 120),
      }))
      .filter((dday) => Boolean(dday.title));
    const normalizedPhotos = photos.map((photo) => ({
      takenAt: photo.takenAt?.toISOString(),
      createdAt: photo.createdAt.toISOString(),
      caption: normalizeText(photo.caption, 200) || undefined,
    }));
    const normalizedNotices = notices.map((notice) => ({
      title: normalizeText(notice.title, 120),
      body: normalizeText(notice.body, 240),
      pinned: Boolean(notice.pinned),
    }));

    const stats: SummaryStats = {
      summaryVersion: SUMMARY_VERSION,
      windowStartYmd: input.windowStartYmd,
      windowEndYmd: input.windowEndYmd,
      todoTotal: todos.length,
      todoDone: todos.filter((todo) => todo.done).length,
      todoPending: todos.filter((todo) => !todo.done).length,
      moodCounts,
      memoCount: memos.length,
      eventCount: expandedEvents.length,
      metricEntryCount: metricEntries.length,
      ddayCount: ddays.length,
      photoCount: photos.length,
      noticeCount: notices.length,
      weatherSnapshotCount: weatherSnapshots.length,
      todos: normalizedTodos,
      moods: normalizedMoods,
      memos: normalizedMemos,
      events: normalizedEvents,
      metricEntries: normalizedMetricEntries,
      ddays: normalizedDdays,
      photos: normalizedPhotos,
      notices: normalizedNotices,
      weatherSnapshots,
    };

    const generated = await generateSummaryText(stats, input.language);
    const saved = await prisma.weeklySummary.update({
      where: uniqueWhere,
      data: {
        dashboardId: input.dashboardId,
        windowEndYmd: input.windowEndYmd,
        status: "ready",
        [summaryField]: generated.summary,
        stats,
        model: generated.model,
        generatedAt: new Date(),
        error: null,
      },
    });

    return mapSummaryRecord(saved, input.language);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Summary generation failed";

    const current = await prisma.weeklySummary.findUnique({
      where: uniqueWhere,
    });
    if (current && hasExpandedSummaryStats(current.stats)) {
      return {
        status: "failed",
        error: message,
        windowStartYmd: input.windowStartYmd,
        windowEndYmd: input.windowEndYmd,
      };
    }

    const failed = await prisma.weeklySummary.upsert({
      where: uniqueWhere,
      update: {
        status: "failed",
        summaryKo: null,
        summaryEn: null,
        stats: Prisma.JsonNull,
        model: null,
        generatedAt: null,
        error: message,
      },
      create: {
        widgetId: input.widgetId,
        dashboardId: input.dashboardId,
        windowStartYmd: input.windowStartYmd,
        windowEndYmd: input.windowEndYmd,
        status: "failed",
        error: message,
      },
    });

    return mapSummaryRecord(failed, input.language);
  } finally {
    await releaseSummaryLock(input.widgetId, input.windowStartYmd).catch(
      () => {},
    );
  }
}

export type { WeeklySummaryResult };
