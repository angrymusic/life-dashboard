import { useCallback, useMemo } from "react";
import { useMembers } from "@/shared/db/queries";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";

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

  const isAdmin = !activeDashboard?.groupId || currentMember?.role === "parent";
  const currentUserId = currentMember?.userId ?? undefined;
  const canCreateWidget = !activeDashboard?.groupId
    ? true
    : Boolean(isSignedIn && currentMember);

  const canEditWidget = useCallback(
    (widget: Widget) => {
      if (!activeDashboard?.groupId) return true;
      if (!isSignedIn) return false;
      if (isAdmin) return true;
      if (!currentUserId) return false;
      return widget.createdBy === currentUserId;
    },
    [activeDashboard?.groupId, isSignedIn, isAdmin, currentUserId]
  );

  const widgetCreatorId = activeDashboard?.groupId ? currentUserId : undefined;

  return { canCreateWidget, canEditWidget, widgetCreatorId };
}
