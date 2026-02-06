import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import prisma from "@/server/prisma";

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

const allowedEntityTypes = new Set([
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
]);
const touchExcludedEntityTypes = new Set(["weatherCache"]);

function jsonError(status: number, error: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error, ...(details ? { details } : {}) },
    { status }
  );
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
  if (typeof value === "string" && value.trim()) return value;
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

const adminRoles = new Set(["parent", "admin"]);

function isAdminRole(role: string | null | undefined) {
  if (!role) return false;
  return adminRoles.has(role);
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.email
    ? (await prisma.user.findUnique({ where: { email: session.user.email } }))?.id
    : null;
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const events = parseEvents(body);
  if (!events) {
    return jsonError(400, "Invalid request body", {
      hint: "Send { events: SyncEvent[] }",
    });
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

  const hasGroupAccess = async (groupId: string) => {
    const member = await getGroupMember(groupId);
    return Boolean(member);
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
    if (dashboard.ownerId && dashboard.ownerId !== userId) {
      throw new Error("Forbidden");
    }
    return { dashboard, role: "parent" };
  };

  const ensureWidgetEditAccess = async (widgetId: string, dashboardId?: string) => {
    const widget = await getWidget(widgetId);
    if (!widget) throw new Error("Widget not found");
    if (dashboardId && widget.dashboardId !== dashboardId) {
      throw new Error("Dashboard mismatch");
    }
    const { role } = await ensureAccessForDashboard(widget.dashboardId);
    if (isAdminRole(role)) return;
    if (widget.createdBy !== userId) {
      throw new Error("Forbidden");
    }
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
    if (!allowedEntityTypes.has(event.entityType)) {
      errors.push({ id: event.id, error: "Unsupported entity type" });
      continue;
    }

    const touchDashboardId =
      event.entityType === "dashboard" ? event.entityId : event.dashboardId;
    const shouldTouchDashboard = !touchExcludedEntityTypes.has(event.entityType);

    try {
      if (event.operation === "delete") {
        if (event.entityType === "dashboard") {
          const dashboard = await getDashboard(event.entityId);
          if (dashboard?.groupId) {
            const allowed = await hasGroupAccess(dashboard.groupId);
            if (!allowed) throw new Error("Forbidden");
          } else if (dashboard?.ownerId && dashboard.ownerId !== userId) {
            throw new Error("Forbidden");
          }
          await prisma.dashboard.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "widget") {
          await ensureWidgetEditAccess(event.entityId, event.dashboardId);
          await prisma.widget.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "memo") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.memo.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "todo") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.todo.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "dday") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.dday.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "photo") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.photo.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "mood") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.mood.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "notice") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.notice.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "metric") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.metric.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "metricEntry") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.metricEntry.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "calendarEvent") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.calendarEvent.deleteMany({ where: { id: event.entityId } });
        } else if (event.entityType === "weatherCache") {
          if (!event.widgetId) throw new Error("Missing widgetId");
          await ensureWidgetEditAccess(event.widgetId, event.dashboardId);
          await prisma.weatherCache.deleteMany({ where: { id: event.entityId } });
        }

        if (shouldTouchDashboard) {
          markDashboardTouched(touchDashboardId, new Date());
        }
        appliedIds.push(event.id);
        continue;
      }

      const payload = event.payload ?? {};

      if (event.entityType === "dashboard") {
        const id = requireString(payload, "id", event.entityId);
        const name = requireString(payload, "name", "Dashboard");
        const groupId = optionalString(payload, "groupId");
        const createdAt = parseDate(payload.createdAt ?? event.createdAt);
        const updatedAt = parseDate(payload.updatedAt ?? event.updatedAt);

        const existing = await getDashboard(id);
        if (existing?.groupId) {
          const allowed = await hasGroupAccess(existing.groupId);
          if (!allowed) throw new Error("Forbidden");
        } else if (existing?.ownerId && existing.ownerId !== userId) {
          throw new Error("Forbidden");
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
      } else if (event.entityType === "widget") {
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
      } else if (event.entityType === "memo") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "todo") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "dday") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "photo") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
        const storagePath = requireString(payload, "storagePath");
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
      } else if (event.entityType === "mood") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "notice") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "metric") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "metricEntry") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
        const metricId = requireString(payload, "metricId");
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
      } else if (event.entityType === "calendarEvent") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
      } else if (event.entityType === "weatherCache") {
        const id = requireString(payload, "id", event.entityId);
        const dashboardId = requireString(payload, "dashboardId", event.dashboardId);
        const widgetId = requireString(payload, "widgetId", event.widgetId);
        await ensureWidgetEditAccess(widgetId, dashboardId);
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
