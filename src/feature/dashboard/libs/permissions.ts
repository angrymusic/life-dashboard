import type { Id, Widget } from "@/shared/db/schema";

export type SharedDashboardMember = {
  role?: string;
  userId?: Id;
};

export type DashboardPermissionState = {
  canCreateWidget: boolean;
  isAdmin: boolean;
  isSharedDashboard: boolean;
  isSignedIn: boolean;
  currentUserId?: Id;
  widgetCreatorId?: Id;
};

type PermissionParams = {
  isSharedDashboard: boolean;
  isSignedIn: boolean;
  member?: SharedDashboardMember;
};

export function resolveDashboardPermissionState({
  isSharedDashboard,
  isSignedIn,
  member,
}: PermissionParams): DashboardPermissionState {
  const isAdmin = !isSharedDashboard || member?.role === "parent";
  const currentUserId = member?.userId;
  const canCreateWidget = isSharedDashboard
    ? Boolean(isSignedIn && member)
    : true;
  const widgetCreatorId = isSharedDashboard ? currentUserId : undefined;

  return {
    canCreateWidget,
    isAdmin,
    isSharedDashboard,
    isSignedIn,
    currentUserId,
    widgetCreatorId,
  };
}

export function canEditWidgetByPermission(
  state: DashboardPermissionState,
  widget: Pick<Widget, "createdBy">
) {
  if (!state.isSharedDashboard) return true;
  if (!state.isSignedIn) return false;
  if (state.isAdmin) return true;
  if (!state.currentUserId) return false;
  return widget.createdBy === state.currentUserId;
}
