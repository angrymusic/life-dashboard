import { useCallback, useMemo } from "react";
import { useMembers } from "@/shared/db/queries";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import {
  canEditWidgetByPermission,
  resolveDashboardPermissionState,
} from "@/feature/dashboard/libs/permissions";

type PermissionsParams = {
  activeDashboard?: Dashboard;
  authEmail: string | null;
  isSignedIn: boolean;
};

type PermissionsResult = {
  canCreateWidget: boolean;
  canEditWidget: (widget: Widget) => boolean;
  widgetCreatorId?: Id;
};

export function useDashboardPermissions({
  activeDashboard,
  authEmail,
  isSignedIn,
}: PermissionsParams): PermissionsResult {
  const members = useMembers();

  const currentMember = useMemo(() => {
    if (!activeDashboard?.groupId || !members || !authEmail) return undefined;
    return members.find(
      (member) =>
        member.groupId === activeDashboard.groupId &&
        member.email?.trim().toLowerCase() === authEmail
    );
  }, [activeDashboard, members, authEmail]);

  const permissionState = useMemo(
    () =>
      resolveDashboardPermissionState({
        isSharedDashboard: Boolean(activeDashboard?.groupId),
        isSignedIn,
        member: currentMember,
      }),
    [activeDashboard?.groupId, currentMember, isSignedIn]
  );

  const canEditWidget = useCallback(
    (widget: Widget) => canEditWidgetByPermission(permissionState, widget),
    [permissionState]
  );

  return {
    canCreateWidget: permissionState.canCreateWidget,
    canEditWidget,
    widgetCreatorId: permissionState.widgetCreatorId,
  };
}
