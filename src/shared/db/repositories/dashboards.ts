import type { Dashboard, Id, ISODate, Member } from "../schema";
import { db, getLocalMembersGroupId, newId, nowIso } from "../core";
import {
  applyEventsToServer,
  buildDeleteEventForRecord,
  buildUpsertEventForRecord,
  recordOutboxDelete,
  recordOutboxUpsert,
  resolveWritePolicy,
  type WriteOptions,
} from "../outbox";

type LocalOwnerProfile = {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  userId?: Id;
};

function buildLocalOwnerMember(
  dashboardId: Id,
  profile: LocalOwnerProfile,
  now: ISODate
): Member {
  const email = profile.email?.trim() || undefined;
  const displayName = profile.displayName?.trim() || email || "사용자";
  const groupId = getLocalMembersGroupId(dashboardId);
  return {
    id: `${groupId}:owner`,
    groupId,
    role: "parent",
    displayName,
    avatarUrl: profile.avatarUrl ?? undefined,
    email,
    userId: profile.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createDashboard(
  params: {
    name: string;
    ownerId?: Id;
    groupId?: Id;
    ownerProfile?: LocalOwnerProfile;
  },
  options: WriteOptions = {}
) {
  const now = nowIso();
  const dashboard: Dashboard = {
    id: newId(),
    name: params.name,
    ownerId: params.ownerId,
    groupId: params.groupId,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.dashboards, db.outbox, db.members], async () => {
    await db.dashboards.add(dashboard);
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: dashboard,
      options,
      now,
    });
    if (!params.groupId) {
      const ownerProfile = params.ownerProfile ?? {};
      await db.members.put(
        buildLocalOwnerMember(
          dashboard.id,
          { ...ownerProfile, userId: ownerProfile.userId ?? params.ownerId },
          now
        )
      );
    }
  });
  return dashboard.id;
}

export async function ensureDefaultDashboard(params: {
  name: string;
  ownerId?: Id;
  ownerProfile?: LocalOwnerProfile;
},
options: WriteOptions = {}
) {
  let createdId: Id | null = null;
  await db.transaction("rw", [db.dashboards, db.outbox, db.members], async () => {
    const count = await db.dashboards.count();
    if (count > 0) return;
    const now = nowIso();
    const dashboard: Dashboard = {
      id: newId(),
      name: params.name,
      ownerId: params.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    await db.dashboards.add(dashboard);
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: dashboard,
      options,
      now,
    });
    const ownerProfile = params.ownerProfile ?? {};
    await db.members.put(
      buildLocalOwnerMember(
        dashboard.id,
        { ...ownerProfile, userId: ownerProfile.userId ?? params.ownerId },
        now
      )
    );
    createdId = dashboard.id;
  });
  return createdId;
}

export async function updateDashboardName(
  dashboardId: Id,
  name: string,
  options: WriteOptions = {}
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await db.dashboards.get(dashboardId);
  if (!existing) return;
  if (existing.name === trimmed) return;
  const policy = await resolveWritePolicy(dashboardId, options);
  const now = nowIso();
  const nextDashboard: Dashboard = {
    ...existing,
    name: trimmed,
    updatedAt: now,
  };
  await db.transaction("rw", [db.dashboards, db.outbox], async () => {
    await db.dashboards.update(dashboardId, {
      name: trimmed,
      updatedAt: now,
    });
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: nextDashboard,
      options: { skipOutbox: policy.skipOutbox },
      now,
    });
  });
  if (policy.syncToServer) {
    const event = buildUpsertEventForRecord("dashboard", nextDashboard, now);
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function deleteDashboardCascade(
  dashboardId: Id,
  options: WriteOptions = {}
) {
  const policy = await resolveWritePolicy(dashboardId, options);
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
      db.members,
      db.outbox,
    ],
    async () => {
      await db.outbox.where("dashboardId").equals(dashboardId).delete();
      await db.members
        .where("groupId")
        .equals(getLocalMembersGroupId(dashboardId))
        .delete();
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
      await db.dashboards.delete(dashboardId);
      await recordOutboxDelete({
        entityType: "dashboard",
        entityId: dashboardId,
        dashboardId,
        options: { skipOutbox: policy.skipOutbox },
      });
    }
  );
  if (policy.syncToServer) {
    const event = buildDeleteEventForRecord("dashboard", { id: dashboardId });
    if (event) {
      await applyEventsToServer([event]);
    }
  }
}

export async function setDashboardGroupId(
  params: {
    dashboardId: Id;
    groupId: Id;
    updatedAt?: ISODate;
  },
  options: WriteOptions = {}
) {
  const updatedAt = params.updatedAt ?? nowIso();
  await db.transaction("rw", [db.dashboards, db.outbox], async () => {
    const existing = await db.dashboards.get(params.dashboardId);
    if (!existing) return;
    const nextDashboard: Dashboard = {
      ...existing,
      groupId: params.groupId,
      updatedAt,
    };
    await db.dashboards.update(params.dashboardId, {
      groupId: params.groupId,
      updatedAt,
    });
    await recordOutboxUpsert({
      entityType: "dashboard",
      record: nextDashboard,
      options,
      now: updatedAt,
    });
  });
}

export async function syncMembersFromServer(members: Member[], groupId?: Id) {
  const groupIds = new Set<Id>();
  if (groupId) groupIds.add(groupId);
  members.forEach((member) => groupIds.add(member.groupId));
  if (groupIds.size === 0) return;
  await db.transaction("rw", db.members, async () => {
    await Promise.all(
      [...groupIds].map((id) => db.members.where("groupId").equals(id).delete())
    );
    if (members.length) {
      await db.members.bulkPut(members);
    }
  });
}

export async function removeDefaultDraftDashboardForSignedInUser(params: {
  ownerId: Id;
  serverDashboards: Dashboard[];
}) {
  if (params.serverDashboards.length === 0) return;

  const serverDashboardIds = new Set(
    params.serverDashboards.map((dashboard) => dashboard.id)
  );
  const localDashboards = await db.dashboards
    .where("ownerId")
    .equals(params.ownerId)
    .toArray();
  const candidates = localDashboards.filter(
    (dashboard) =>
      !dashboard.groupId &&
      dashboard.name === "My Dashboard" &&
      !serverDashboardIds.has(dashboard.id)
  );

  for (const dashboard of candidates) {
    const [widgetCount, outboxEvents] = await Promise.all([
      db.widgets.where("dashboardId").equals(dashboard.id).count(),
      db.outbox.where("dashboardId").equals(dashboard.id).toArray(),
    ]);
    if (widgetCount > 0) continue;

    const hasOnlyCreateEvent = outboxEvents.every(
      (event) =>
        event.entityType === "dashboard" &&
        event.operation === "upsert" &&
        event.entityId === dashboard.id
    );
    if (!hasOnlyCreateEvent) continue;

    await deleteDashboardCascade(dashboard.id, { skipOutbox: true });
  }
}

export async function syncDashboardsFromServer(dashboards: Dashboard[]) {
  const serverIds = new Set(dashboards.map((dashboard) => dashboard.id));
  const localDashboards = await db.dashboards.toArray();
  const missingShared = localDashboards.filter(
    (dashboard) => dashboard.groupId && !serverIds.has(dashboard.id)
  );

  if (dashboards.length) {
    await db.transaction("rw", db.dashboards, async () => {
      await db.dashboards.bulkPut(dashboards);
    });
  }

  if (missingShared.length) {
    for (const dashboard of missingShared) {
      await removeSharedDashboardLocally(dashboard.id, dashboard.groupId);
    }
  }
}

export async function removeSharedDashboardLocally(
  dashboardId: Id,
  groupId?: Id
) {
  const resolvedGroupId =
    groupId ?? (await db.dashboards.get(dashboardId))?.groupId;
  if (!resolvedGroupId) return;

  await deleteDashboardCascade(dashboardId, { skipOutbox: true });

  const remaining = await db.dashboards
    .where("groupId")
    .equals(resolvedGroupId)
    .count();
  if (remaining === 0) {
    await db.members.where("groupId").equals(resolvedGroupId).delete();
  }
}
