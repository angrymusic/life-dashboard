"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, User, Users } from "lucide-react";
import Image from "next/image";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useMembers } from "@/shared/db/queries";
import { useSession } from "next-auth/react";
import AccountDialog from "./AccountDialog";
import DashboardManagerDialog from "./DashboardManagerDialog";
import MembersDialog from "./MembersDialog";

type HeaderProps = {
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
};

export default function Header({
  dashboards,
  activeDashboardId,
  onSelectDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
}: HeaderProps) {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const { data: session, status: authStatus } = useSession();
  const members = useMembers();

  const groupMemberCounts = useMemo(() => {
    const counts = new Map<Id, number>();
    if (!members) return counts;
    members.forEach((member) => {
      counts.set(member.groupId, (counts.get(member.groupId) ?? 0) + 1);
    });
    return counts;
  }, [members]);

  const activeDashboard = dashboards?.find(
    (dashboard) => dashboard.id === activeDashboardId
  );
  const getMemberCount = (dashboard?: Dashboard) => {
    if (!dashboard?.groupId) return 0;
    return groupMemberCounts.get(dashboard.groupId) ?? 0;
  };
  const headerTitle = activeDashboard
    ? activeDashboard.name
    : dashboards === undefined
      ? "대시보드 불러오는 중..."
      : "대시보드 없음";
  const activeMemberCount = getMemberCount(activeDashboard);
  const authUser = session?.user ?? null;
  const isAuthLoading = authStatus === "loading";
  const isSignedIn = authStatus === "authenticated";
  const authDisplayName = authUser?.name ?? authUser?.email ?? "사용자";
  const authAvatarFallback = authDisplayName.trim().slice(0, 1) || "?";

  return (
    <header className="sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center p-4 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="대시보드 관리"
          className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80"
          onClick={() => setDashboardDialogOpen(true)}
        >
          <LayoutDashboard className="h-5 w-5" />
        </Button>
      </div>

      <div className="border bg-white/60 backdrop-blur-[2px] hover:bg-white/80 shadow-sm px-6 py-2 rounded-full font-medium text-sm pointer-events-auto flex min-w-0 items-center gap-2 max-w-[60vw] justify-self-center">
        <span className="truncate">{headerTitle}</span>
        {activeDashboard ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              activeMemberCount > 0
                ? "border-amber-200/70 bg-amber-50 text-amber-700"
                : "border-gray-200/70 bg-gray-100 text-gray-500"
            )}
          >
            {activeMemberCount > 0 ? "공유" : "개인"}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 pointer-events-auto">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="구성원 설정"
          className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80"
          onClick={() => setMembersDialogOpen(true)}
          disabled={!activeDashboard}
        >
          <Users className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="계정"
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
        getMemberCount={getMemberCount}
        isSignedIn={isSignedIn}
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
