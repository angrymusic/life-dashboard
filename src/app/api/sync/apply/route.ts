import { NextResponse } from "next/server";
import prisma from "@/server/prisma";
import { jsonError, parseJson } from "@/server/api-response";
import { isAdminRole, requireUser } from "@/server/api-auth";
import { enforceRateLimit, parsePositiveIntEnv } from "@/server/request-guards";
import {
  isLegacyPhotoStoragePath,
  isValidPhotoStoragePathForDashboard,
} from "@/server/photo-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncOperation = "upsert" | "delete";

type SyncEvent = {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload?: Record<string, unknown>;
  dashboardId?: string;
  widgetId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApplyResult = {
  ok: boolean;
  appliedIds: string[];
  dashboards?: { id: string; updatedAt: string }[];
  errors?: { id: string; error: string }[];
};

const entityTypes = [
  "dashboard",
  "widget",
  "memo",
  "todo",
  "dday",
  "photo",
  "mood",
  "notice",
  "metric",
  "metricEntry",
  "calendarEvent",
  "weatherCache",
] as const;

type EntityType = (typeof entityTypes)[number];

const allowedEntityTypes = new Set<EntityType>(entityTypes);
const touchExcludedEntityTypes = new Set<EntityType>(["weatherCache"]);

function isEntityType(value: string): value is EntityType {
  return allowedEntityTypes.has(value as EntityType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(obj: Record<string, unknown>, key: string, fallback?: string) {
  const value = obj[key];
  if (typeof value === "string" && value.trim()) return value;
  if (fallback) return fallback;
  throw new Error(`Missing field: ${key}`);
}

function optionalString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function parseDate(value: unknown, fallback?: Date) {
  if (typeof value !== "string") return fallback ?? new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback ?? new Date();
  return parsed;
}

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return parseDate(value as string);
}

function parseEvents(body: unknown): SyncEvent[] | null {
  if (!isRecord(body)) return null;
  const rawEvents = body.events;
  if (!Array.isArray(rawEvents)) return null;
  const events: SyncEvent[] = [];
  for (const item of rawEvents) {
    if (!isRecord(item)) return null;
    const id = item.id;
    const entityType = item.entityType;
    const entityId = item.entityId;
    const operation = item.operation;
    if (typeof id !== "string" || typeof entityType !== "string" || typeof entityId !== "string") {
      return null;
    }
    if (operation !== "upsert" && operation !== "delete") return null;
    events.push({
      id,
      entityType,
      entityId,
      operation,
      payload: isRecord(item.payload) ? item.payload : undefined,
      dashboardId: typeof item.dashboardId === "string" ? item.dashboardId : undefined,
      widgetId: typeof item.widgetId === "string" ? item.widgetId : undefined,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    });
  }
  return events;
}

type EntityHandler = {
  delete: (event: SyncEvent) => Promise<void>;
  upsert: (event: SyncEvent, payload: Record<string, unknown>) => Promise<void>;
};

export async function POST(request: Request) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const rateLimit = await enforceRateLimit({
    key: `sync-apply:${userId}`,
    limit: parsePositiveIntEnv(process.env.SYNC_APPLY_RATE_LIMIT, 120),
    windowMs: parsePositiveIntEnv(
      process.env.SYNC_APPLY_RATE_WINDOW_MS,
      60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const parsedBody = await parseJson(request, {
    maxBytes: parsePositiveIntEnv(
      process.env.SYNC_APPLY_MAX_BYTES,
      1024 * 1024
    ),
  });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const events = parseEvents(body);
  if (!events) {
    return jsonError(400, "Invalid request body", {
      hint: "Send { events: SyncEvent[] }",
    });
  }
  const maxEvents = parsePositiveIntEnv(
    process.env.SYNC_APPLY_MAX_EVENTS,
    2000
  );
  if (events.length > maxEvents) {
    return jsonError(413, "Too many events", { maxEvents });
  }

  const dashboardCache = new Map<
    string,
    { id: string; ownerId: string | null; groupId: string | null } | null
  >();
  const groupMemberCache = new Map<string, { id: string; role: string } | null>();
  const widgetCache = new Map<
    string,
    { id: string; dashboardId: string; createdBy: string | null } | null
  >();

  const getDashboard = async (dashboardId: string) => {
    if (dashboardCache.has(dashboardId)) {
      return dashboardCache.get(dashboardId) ?? null;
    }
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { id: true, ownerId: true, groupId: true },
    });
    dashboardCache.set(dashboardId, dashboard ?? null);
    return dashboard ?? null;
  };

  const getGroupMember = async (groupId: string) => {
    if (groupMemberCache.has(groupId)) {
      return groupMemberCache.get(groupId) ?? null;
    }
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
      select: { id: true, role: true },
    });
    groupMemberCache.set(groupId, member ?? null);
    return member ?? null;
  };

  const getWidget = async (widgetId: string) => {
    if (widgetCache.has(widgetId)) {
      return widgetCache.get(widgetId) ?? null;
    }
    const widget = await prisma.widget.findUnique({
      where: { id: widgetId },
      select: { id: true, dashboardId: true, createdBy: true },
    });
    if (widget) {
      widgetCache.set(widgetId, widget);
    }
    return widget ?? null;
  };

  const ensureAccessForDashboard = async (dashboardId: string) => {
    const dashboard = await getDashboard(dashboardId);
    if (!dashboard) throw new Error("Dashboard not found");
    if (dashboard.groupId) {
      const member = await getGroupMember(dashboard.groupId);
      if (!member) throw new Error("Forbidden");
      return { dashboard, role: member.role };
    }
    if (!dashboard.ownerId || dashboard.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    return { dashboard, role: "parent" };
  };

  const ensureDashboardAdminAccess = async (dashboardId: string) => {
    const access = await ensureAccessForDashboard(dashboardId);
    if (access.dashboard.groupId && !isAdminRole(access.role)) {
      throw new Error("Forbidden");
    }
    return access.dashboard;
  };

  const ensureGroupAdminAccess = async (groupId: string) => {
    const member = await getGroupMember(groupId);
    if (!member || !isAdminRole(member.role)) {
      throw new Error("Forbidden");
    }
  };

  const ensureWidgetAccess = async (
    widgetId: string,
    dashboardId?: string,
    options?: { allowMissing?: boolean }
  ) => {
    const widget = await getWidget(widgetId);
    if (!widget) {
      if (options?.allowMissing) return null;
      throw new Error("Widget not found");
    }
    if (dashboardId && widget.dashboardId !== dashboardId) {
      throw new Error("Dashboard mismatch");
    }
    const { role } = await ensureAccessForDashboard(widget.dashboardId);
    if (isAdminRole(role)) return widget;
    if (widget.createdBy !== userId) {
      throw new Error("Forbidden");
    }
    return widget;
  };

  const ensureWidgetEditAccess = async (widgetId: string, dashboardId?: string) => {
    await ensureWidgetAccess(widgetId, dashboardId);
  };

  type ScopedEntity = {
    widgetId: string;
    dashboardId: string;
  };

  const ensureScopedEntityUpsertAccess = async (
    event: SyncEvent,
    payload: Record<string, unknown>,
    loadExisting: (entityId: string) => Promise<ScopedEntity | null>
  ) => {
    const id = requireString(payload, "id", event.entityId);
    const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
    const widgetId = requireString(payload, "widgetId", event.widgetId);

    const existing = await loadExisting(id);
    if (existing) {
      if (
        existing.dashboardId !== dashboardId ||
        existing.widgetId !== widgetId
      ) {
        throw new Error("Entity scope mismatch");
      }
      await ensureWidgetEditAccess(existing.widgetId, existing.dashboardId);
      return { id, dashboardId, widgetId };
    }

    await ensureWidgetEditAccess(widgetId, dashboardId);
    return { id, dashboardId, widgetId };
  };

  const ensureEventWidgetDeleteAccess = async (event: SyncEvent) => {
    if (!event.widgetId) throw new Error("Missing widgetId");
    const widget = await ensureWidgetAccess(event.widgetId, event.dashboardId, {
      allowMissing: true,
    });
    const dashboardId = event.dashboardId ?? widget?.dashboardId;
    if (!dashboardId) throw new Error("Missing dashboardId");
    return { widgetId: event.widgetId, dashboardId };
  };

  const handlers: Record<EntityType, EntityHandler> = {
    dashboard: {
      delete: async (event) => {
        const dashboard = await getDashboard(event.entityId);
        if (!dashboard) return;
        if (dashboard.groupId) {
          const member = await getGroupMember(dashboard.groupId);
          if (!member || !isAdminRole(member.role)) throw new Error("Forbidden");
        } else if (!dashboard.ownerId || dashboard.ownerId !== userId) {
          throw new Error("Forbidden");
        }
        await prisma.dashboard.deleteMany({ where: { id: event.entityId } });
        dashboardCache.set(event.entityId, null);
      },
      upsert: async (event, payload) => {
        const id = requireString(payload, "id", event.entityId);
        const name = requireString(payload, "name", "Dashboard");
        const groupId = optionalString(payload, "groupId");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        const existing = await getDashboard(id);
        if (existing) {
          await ensureDashboardAdminAccess(existing.id);
          if (groupId && groupId !== existing.groupId) {
            await ensureGroupAdminAccess(groupId);
          }
        } else if (groupId) {
          await ensureGroupAdminAccess(groupId);
        }

        await prisma.dashboard.upsert({
          where: { id },
          update: {
            name,
            ...(groupId ? { groupId } : {}),
            ownerId: userId,
            updatedAt,
          },
          create: {
            id,
            name,
            groupId: groupId ?? undefined,
            ownerId: userId,
            createdAt,
            updatedAt,
          },
        });
        dashboardCache.set(id, {
          id,
          ownerId: userId,
          groupId: groupId ?? existing?.groupId ?? null,
        });
      },
    },
    widget: {
      delete: async (event) => {
        const widget = await ensureWidgetAccess(event.entityId, event.dashboardId, {
          allowMissing: true,
        });
        if (!widget) return;
        await prisma.widget.deleteMany({
          where: {
            id: event.entityId,
            dashboardId: widget.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const existingWidget = await getWidget(id);
        if (existingWidget) {
          await ensureWidgetEditAccess(id, dashboardId);
        } else {
          await ensureAccessForDashboard(dashboardId);
        }
        const type = requireString(payload, "type");
        const layout = payload.layout ?? {};
        const settings = payload.settings ?? undefined;
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.widget.upsert({
          where: { id },
          update: {
            dashboardId,
            type,
            layout,
            settings,
            updatedAt,
          },
          create: {
            id,
            dashboardId,
            type,
            layout,
            settings,
            createdBy: userId,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    memo: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.memo.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.memo.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const text = requireString(payload, "text");
        const color = optionalString(payload, "color");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.memo.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            text,
            color,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            text,
            color,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    todo: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.todo.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.todo.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const date = requireString(payload, "date");
        const title = requireString(payload, "title");
        const done = Boolean(payload.done);
        const order = typeof payload.order === "number" ? payload.order : undefined;
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.todo.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            date,
            title,
            done,
            order,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            date,
            title,
            done,
            order,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    dday: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.dday.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.dday.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const title = requireString(payload, "title");
        const date = requireString(payload, "date");
        const color = optionalString(payload, "color");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.dday.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            title,
            date,
            color,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            title,
            date,
            color,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    photo: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.photo.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.photo.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const storagePath = requireString(payload, "storagePath");
        const existingPhoto = await prisma.photo.findUnique({
          where: { id },
          select: { storagePath: true },
        });
        const allowLegacyPath =
          Boolean(existingPhoto) &&
          existingPhoto?.storagePath === storagePath &&
          isLegacyPhotoStoragePath(storagePath);
        if (
          !allowLegacyPath &&
          !isValidPhotoStoragePathForDashboard(storagePath, dashboardId)
        ) {
          throw new Error("Invalid photo path");
        }
        const mimeType = requireString(payload, "mimeType");
        const caption = optionalString(payload, "caption");
        const takenAt = parseOptionalDate(payload.takenAt);
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.photo.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            storagePath,
            mimeType,
            caption,
            takenAt,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            storagePath,
            mimeType,
            caption,
            takenAt,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    mood: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.mood.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.mood.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const date = requireString(payload, "date");
        const mood = requireString(payload, "mood");
        const note = optionalString(payload, "note");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.mood.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            date,
            mood,
            note,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            date,
            mood,
            note,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    notice: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.notice.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.notice.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const title = requireString(payload, "title");
        const bodyText = requireString(payload, "body");
        const pinned = typeof payload.pinned === "boolean" ? payload.pinned : undefined;
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.notice.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            title,
            body: bodyText,
            pinned,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            title,
            body: bodyText,
            pinned,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    metric: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.metric.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.metric.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const name = requireString(payload, "name");
        const unit = optionalString(payload, "unit");
        const chartType = optionalString(payload, "chartType");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.metric.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            name,
            unit,
            chartType,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            name,
            unit,
            chartType,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    metricEntry: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.metricEntry.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.metricEntry.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const metricId = requireString(payload, "metricId");
        const metric = await prisma.metric.findUnique({
          where: { id: metricId },
          select: { widgetId: true, dashboardId: true },
        });
        if (
          !metric ||
          metric.dashboardId !== dashboardId ||
          metric.widgetId !== widgetId
        ) {
          throw new Error("Metric scope mismatch");
        }
        const date = requireString(payload, "date");
        const value = Number(payload.value);
        if (!Number.isFinite(value)) throw new Error("Invalid value");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.metricEntry.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            metricId,
            date,
            value,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            metricId,
            date,
            value,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    calendarEvent: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.calendarEvent.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.calendarEvent.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const title = requireString(payload, "title");
        const startAt = parseDate(payload.startAt);
        const endAt = parseOptionalDate(payload.endAt);
        const allDay = typeof payload.allDay === "boolean" ? payload.allDay : undefined;
        const location = optionalString(payload, "location");
        const description = optionalString(payload, "description");
        const color = optionalString(payload, "color");
        const recurrence = payload.recurrence ?? undefined;
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.calendarEvent.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            title,
            startAt,
            endAt,
            allDay,
            location,
            description,
            color,
            recurrence,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            title,
            startAt,
            endAt,
            allDay,
            location,
            description,
            color,
            recurrence,
            createdAt,
            updatedAt,
          },
        });
      },
    },
    weatherCache: {
      delete: async (event) => {
        const scope = await ensureEventWidgetDeleteAccess(event);
        await prisma.weatherCache.deleteMany({
          where: {
            id: event.entityId,
            widgetId: scope.widgetId,
            dashboardId: scope.dashboardId,
          },
        });
      },
      upsert: async (event, payload) => {
        const { id, dashboardId, widgetId } = await ensureScopedEntityUpsertAccess(
          event,
          payload,
          async (entityId) =>
            prisma.weatherCache.findUnique({
              where: { id: entityId },
              select: { widgetId: true, dashboardId: true },
            })
        );
        const locationKey = requireString(payload, "locationKey");
        const fetchedAt = parseDate(payload.fetchedAt);
        const payloadValue = payload.payload ?? {};
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        await prisma.weatherCache.upsert({
          where: { id },
          update: {
            widgetId,
            dashboardId,
            locationKey,
            payload: payloadValue,
            fetchedAt,
            updatedAt,
          },
          create: {
            id,
            widgetId,
            dashboardId,
            locationKey,
            payload: payloadValue,
            fetchedAt,
            createdAt,
            updatedAt,
          },
        });
      },
    },
  };

  const appliedIds: string[] = [];
  const errors: { id: string; error: string }[] = [];
  const touchedDashboards = new Map<string, Date>();
  let touchedDashboardUpdates: { id: string; updatedAt: string }[] = [];

  const markDashboardTouched = (
    dashboardId: string | undefined | null,
    touchedAt: Date
  ) => {
    if (!dashboardId) return;
    const existing = touchedDashboards.get(dashboardId);
    if (!existing || existing < touchedAt) {
      touchedDashboards.set(dashboardId, touchedAt);
    }
  };

  for (const event of events) {
    if (!isEntityType(event.entityType)) {
      errors.push({ id: event.id, error: "Unsupported entity type" });
      continue;
    }

    const touchDashboardId =
      event.entityType === "dashboard" ? event.entityId : event.dashboardId;
    const shouldTouchDashboard = !touchExcludedEntityTypes.has(event.entityType);
    const handler = handlers[event.entityType];

    try {
      if (event.operation === "delete") {
        await handler.delete(event);
      } else {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        await handler.upsert(event, payload);
      }

      if (shouldTouchDashboard) {
        markDashboardTouched(touchDashboardId, new Date());
      }
      appliedIds.push(event.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push({ id: event.id, error: message });
    }
  }

  if (touchedDashboards.size) {
    const entries = [...touchedDashboards.entries()];
    try {
      await Promise.all(
        entries.map(([dashboardId, updatedAt]) =>
          prisma.dashboard.updateMany({
            where: { id: dashboardId },
            data: { updatedAt },
          })
        )
      );
      touchedDashboardUpdates = entries.map(([dashboardId, updatedAt]) => ({
        id: dashboardId,
        updatedAt: updatedAt.toISOString(),
      }));
    } catch {
      // Ignore timestamp update failures to avoid blocking sync responses.
    }
  }

  const result: ApplyResult = {
    ok: errors.length === 0,
    appliedIds,
    ...(touchedDashboardUpdates.length
      ? { dashboards: touchedDashboardUpdates }
      : {}),
    ...(errors.length ? { errors } : {}),
  };

  return NextResponse.json(result, { status: errors.length ? 207 : 200 });
}
