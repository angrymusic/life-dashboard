"use client";

import {
  addCalendarEvent,
  addDday,
  addMetricEntry,
  addMood,
  addTodoItem,
  addWidget,
  createDashboard,
  createMetric,
  db,
  deleteDashboardCascade,
  getOrCreateLocalProfileId,
  newId,
  nowIso,
} from "@/shared/db/db";
import type { Id, YMD } from "@/shared/db/schema";
import type { AppLanguage } from "@/shared/i18n/language";
import {
  getDashboardTemplate,
  getLocalizedText,
  toYmd,
  type DashboardTemplateSlug,
} from "./dashboardTemplates";

type ApplyDashboardTemplateParams = {
  slug: DashboardTemplateSlug;
  language: AppLanguage;
};

type ApplyDashboardTemplateToExistingDashboardParams =
  ApplyDashboardTemplateParams & {
    dashboardId: Id;
  };

type SeedDashboardTemplateParams = {
  dashboardId: Id;
  slug: DashboardTemplateSlug;
  language: AppLanguage;
  createdBy?: Id;
  skipOutbox?: boolean;
};

function addDays(baseDate: Date, offsetDays: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return nextDate;
}

function buildDateAtTime(
  baseDate: Date,
  offsetDays: number,
  hour = 0,
  minute = 0
) {
  const nextDate = addDays(baseDate, offsetDays);
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}

async function buildTemplatePhotoPayload(src: string) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("Template photo not found.");
  }

  const blob = await response.blob();

  return {
    type: "photo" as const,
    data: {
      blob,
      mimeType: blob.type || "application/octet-stream",
      caption: undefined,
      takenAt: nowIso(),
    },
  };
}

export async function clearTemplateDashboardData(dashboardId: Id) {
  await db.transaction(
    "rw",
    [
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
      db.outbox,
    ],
    async () => {
      await db.outbox.where("dashboardId").equals(dashboardId).delete();
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
    }
  );
}

export async function seedDashboardTemplate({
  dashboardId,
  slug,
  language,
  createdBy,
  skipOutbox,
}: SeedDashboardTemplateParams) {
  const template = getDashboardTemplate(slug);
  if (!template) {
    throw new Error("Template not found.");
  }
  const baseDate = new Date();
  const todayYmd = toYmd(baseDate);
  const writeOptions = skipOutbox ? { skipOutbox: true } : undefined;

  for (const widget of template.widgets) {
    if (widget.type === "memo") {
      await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
          payload: template.memo
            ? {
                type: "memo",
                data: {
                  text: getLocalizedText(template.memo.text, language),
                  color: template.memo.color,
                },
              }
            : undefined,
        },
        writeOptions
      );
      continue;
    }

    if (widget.type === "photo") {
      await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
          payload: template.photo
            ? await buildTemplatePhotoPayload(template.photo.src)
            : undefined,
        },
        writeOptions
      );
      continue;
    }

    if (widget.type === "todo") {
      const widgetId = await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
        },
        writeOptions
      );

      for (const [index, todo] of (template.todos ?? []).entries()) {
        await addTodoItem(
          {
            widgetId,
            dashboardId,
            date: todayYmd,
            title: getLocalizedText(todo.title, language),
            done: todo.done,
            order: index,
          },
          writeOptions
        );
      }
      continue;
    }

    if (widget.type === "calendar") {
      const widgetId = await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
        },
        writeOptions
      );

      for (const event of template.calendarEvents ?? []) {
        const startAt = buildDateAtTime(
          baseDate,
          event.offsetDays,
          event.allDay ? 0 : event.startHour ?? 9,
          event.allDay ? 0 : event.startMinute ?? 0
        );
        const endAt =
          event.allDay || !event.durationMinutes
            ? undefined
            : new Date(startAt.getTime() + event.durationMinutes * 60 * 1000);
        const timestamp = nowIso();

        await addCalendarEvent(
          {
            id: newId(),
            widgetId,
            dashboardId,
            title: getLocalizedText(event.title, language),
            startAt: startAt.toISOString(),
            endAt: endAt?.toISOString(),
            allDay: event.allDay,
            location: event.location
              ? getLocalizedText(event.location, language)
              : undefined,
            description: event.description
              ? getLocalizedText(event.description, language)
              : undefined,
            color: event.color,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          writeOptions
        );
      }
      continue;
    }

    if (widget.type === "dday") {
      const widgetId = await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
        },
        writeOptions
      );

      if (template.dday) {
        await addDday(
          {
            widgetId,
            dashboardId,
            title: getLocalizedText(template.dday.title, language),
            date: toYmd(addDays(baseDate, template.dday.offsetDays)),
            color: template.dday.color,
          },
          writeOptions
        );
      }
      continue;
    }

    if (widget.type === "chart") {
      const widgetId = await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          settings: {
            isConfigured: true,
            autoOpenSettings: false,
          },
          createdBy,
        },
        writeOptions
      );

      if (template.chart) {
        const metricId = await createMetric(
          {
            widgetId,
            dashboardId,
            name: getLocalizedText(template.chart.name, language),
            unit: template.chart.unit
              ? getLocalizedText(template.chart.unit, language)
              : undefined,
            chartType: template.chart.chartType ?? "line",
          },
          writeOptions
        );

        for (const entry of template.chart.entries) {
          await addMetricEntry(
            {
              widgetId,
              dashboardId,
              metricId,
              date: toYmd(addDays(baseDate, entry.dateOffsetDays)),
              value: entry.value,
            },
            writeOptions
          );
        }
      }
      continue;
    }

    if (widget.type === "mood") {
      const widgetId = await addWidget(
        {
          dashboardId,
          type: widget.type,
          layout: widget.layout,
          createdBy,
        },
        writeOptions
      );

      if (template.mood) {
        await addMood(
          {
            widgetId,
            dashboardId,
            date: todayYmd as YMD,
            mood: template.mood.mood,
            note: template.mood.note
              ? getLocalizedText(template.mood.note, language)
              : undefined,
          },
          writeOptions
        );
      }
      continue;
    }

    await addWidget(
      {
        dashboardId,
        type: widget.type,
        layout: widget.layout,
        createdBy,
      },
      writeOptions
    );
  }
}

export async function applyDashboardTemplate({
  slug,
  language,
}: ApplyDashboardTemplateParams) {
  const template = getDashboardTemplate(slug);
  if (!template) {
    throw new Error("Template not found.");
  }

  const ownerId = getOrCreateLocalProfileId();
  const createdBy = ownerId as Id;
  let dashboardId: Id | null = null;

  try {
    dashboardId = await createDashboard({
      name: getLocalizedText(template.dashboardName, language),
      ownerId,
    });

    await seedDashboardTemplate({
      dashboardId,
      slug,
      language,
      createdBy,
    });

    return dashboardId;
  } catch (error) {
    if (dashboardId) {
      try {
        await deleteDashboardCascade(dashboardId);
      } catch {
        // Ignore cleanup failure and preserve the original error.
      }
    }
    throw error;
  }
}

export async function applyDashboardTemplateToExistingDashboard({
  dashboardId,
  slug,
  language,
}: ApplyDashboardTemplateToExistingDashboardParams) {
  const template = getDashboardTemplate(slug);
  if (!template) {
    throw new Error("Template not found.");
  }

  const targetDashboard = await db.dashboards.get(dashboardId);
  if (!targetDashboard) {
    throw new Error("Dashboard not found.");
  }

  const createdBy = (targetDashboard.ownerId ?? getOrCreateLocalProfileId()) as Id;

  try {
    await clearTemplateDashboardData(dashboardId);
    await seedDashboardTemplate({
      dashboardId,
      slug,
      language,
      createdBy,
    });

    return dashboardId;
  } catch (error) {
    try {
      await clearTemplateDashboardData(dashboardId);
    } catch {
      // Ignore cleanup failure and preserve the original error.
    }
    throw error;
  }
}
