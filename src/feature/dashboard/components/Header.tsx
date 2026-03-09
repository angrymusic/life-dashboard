"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, User, Users } from "lucide-react";
import Image from "next/image";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { getLocalMembersGroupId } from "@/shared/db/db";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useMembers } from "@/shared/db/queries";
import { useI18n } from "@/shared/i18n/client";
import { useSession } from "next-auth/react";
import AccountDialog from "./AccountDialog";
import DashboardManagerDialog from "./dashboard-manager/DashboardManagerDialog";
import MembersDialog from "./MembersDialog";

type HeaderProps = {
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
  onLeaveDashboard: (dashboardId: Id) => Promise<void>;
  onRefreshDashboards: () => Promise<void>;
  isRefreshingDashboards: boolean;
};

export default function Header({
  dashboards,
  activeDashboardId,
  onSelectDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
  onLeaveDashboard,
  onRefreshDashboards,
  isRefreshingDashboards,
}: HeaderProps) {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const { data: session, status: authStatus } = useSession();
  const { t } = useI18n();
  const members = useMembers();

  const activeDashboard = dashboards?.find(
    (dashboard) => dashboard.id === activeDashboardId
  );
  const headerTitle = activeDashboard
    ? activeDashboard.name
    : dashboards === undefined
      ? t("대시보드 불러오는 중...", "Loading dashboards...")
      : t("대시보드 없음", "No dashboard");
  const isActiveShared = Boolean(activeDashboard?.groupId);
  const authUser = session?.user ?? null;
  const isAuthLoading = authStatus === "loading";
  const isSignedIn = authStatus === "authenticated";
  const authDisplayName = authUser?.name ?? authUser?.email ?? t("사용자", "User");
  const authAvatarFallback = authDisplayName.trim().slice(0, 1) || "?";
  const activeMembers = useMemo(() => {
    if (!members) return [];
    const dashboardId = activeDashboard?.id;
    const groupId =
      activeDashboard?.groupId ??
      (dashboardId ? getLocalMembersGroupId(dashboardId) : undefined);
    if (!groupId) return [];
    return members
      .filter((member) => member.groupId === groupId)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [members, activeDashboard?.groupId, activeDashboard?.id]);
  const memberTitle = useMemo(() => {
    if (!activeMembers.length) return "";
    return activeMembers
      .map((member) =>
        [member.displayName, member.email].filter(Boolean).join(" · ")
      )
      .join(", ");
  }, [activeMembers]);
  const visibleMembers = activeMembers.slice(0, 4);
  const extraCount = Math.max(0, activeMembers.length - visibleMembers.length);
  const shouldShowMemberPreview = activeMembers.length > 1;

  return (
    <header className="pointer-events-none sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center p-3 sm:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={t("대시보드 관리", "Manage dashboards")}
          data-tour-target="dashboard-manage"
          className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80"
          onClick={() => setDashboardDialogOpen(true)}
        >
          <LayoutDashboard className="h-5 w-5" />
        </Button>
      </div>

      <div className="pointer-events-auto flex min-w-0 max-w-[calc(100vw-9rem)] items-center gap-2 justify-self-center rounded-full border bg-white/60 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-[2px] hover:bg-white/80 sm:max-w-[60vw] sm:px-6">
        <span className="truncate">{headerTitle}</span>
        {activeDashboard ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
              isActiveShared
                ? "border-amber-200/70 bg-amber-50 text-amber-700"
                : "border-gray-200/70 bg-gray-100 text-gray-500"
            )}
          >
            {isActiveShared ? t("공유", "Shared") : t("개인", "Personal")}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2">
        {shouldShowMemberPreview ? (
          <div
            className="hidden items-center gap-2 sm:flex"
            title={t(
              `구성원 ${activeMembers.length}명: ${memberTitle}`,
              `${activeMembers.length} members: ${memberTitle}`
            )}
          >
            <div className="flex items-center">
              {visibleMembers.map((member, index) => {
                const fallback =
                  member.displayName?.trim().slice(0, 1) ||
                  member.email?.trim().slice(0, 1) ||
                  "?";
                return (
                  <div
                    key={member.id}
                    className={cn(
                      "relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-gray-100 text-[10px] font-semibold text-gray-700 shadow-sm dark:border-gray-900/60 dark:bg-gray-800 dark:text-gray-200",
                      index === 0 ? "" : "-ml-3"
                    )}
                  >
                    {member.avatarUrl ? (
                      <Image
                        src={member.avatarUrl}
                        alt={member.displayName || t("구성원", "Member")}
                        fill
                        sizes="28px"
                        className="rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{fallback}</span>
                    )}
                  </div>
                );
              })}
              {extraCount > 0 ? (
                <div className="relative -ml-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-gray-900 text-[10px] font-semibold text-white shadow-sm dark:border-gray-900/60">
                  +{extraCount}
                </div>
              ) : null}
            </div>
            <span className="text-[10px] text-gray-500">
              {t(`${activeMembers.length}명`, `${activeMembers.length}`)}
            </span>
          </div>
        ) : null}
        <div className="relative">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t("구성원 설정", "Manage members")}
            data-tour-target="member-manage"
            className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80"
            onClick={() => setMembersDialogOpen(true)}
            disabled={!activeDashboard}
          >
            <Users className="h-5 w-5" />
          </Button>
          {shouldShowMemberPreview ? (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-none text-white sm:hidden">
              {activeMembers.length}
            </span>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={t("계정", "Account")}
          data-tour-target="account-manage"
          className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80"
          onClick={() => setAccountDialogOpen(true)}
        >
          {authUser?.image ? (
            <Image
              src={authUser.image}
              alt={authDisplayName}
              width={24}
              height={24}
              className="h-6 w-6 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : isSignedIn ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {authAvatarFallback}
            </span>
          ) : (
            <User className="h-5 w-5" />
          )}
        </Button>
      </div>

      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        authUser={authUser}
        isAuthLoading={isAuthLoading}
        isSignedIn={isSignedIn}
        authDisplayName={authDisplayName}
        authAvatarFallback={authAvatarFallback}
      />

      <DashboardManagerDialog
        open={dashboardDialogOpen}
        onOpenChange={setDashboardDialogOpen}
        dashboards={dashboards}
        activeDashboardId={activeDashboardId}
        onSelectDashboard={onSelectDashboard}
        onCreateDashboard={onCreateDashboard}
        onRenameDashboard={onRenameDashboard}
        onDeleteDashboard={onDeleteDashboard}
        onLeaveDashboard={onLeaveDashboard}
        isSignedIn={isSignedIn}
        onRefreshDashboards={isSignedIn ? onRefreshDashboards : undefined}
        isRefreshingDashboards={isRefreshingDashboards}
      />

      <MembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        activeDashboard={activeDashboard}
        members={members}
        isSignedIn={isSignedIn}
      />
    </header>
  );
}
