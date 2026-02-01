"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, Menu, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useMembers } from "@/shared/db/queries";

type HeaderProps = {
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
};

export default function Header({
  dashboards,
  activeDashboardId,
  onSelectDashboard,
  onCreateDashboard,
  onDeleteDashboard,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Dashboard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
  const canDelete = (dashboards?.length ?? 0) > 1;
  const headerTitle = activeDashboard
    ? activeDashboard.name
    : dashboards === undefined
      ? "대시보드 불러오는 중..."
      : "대시보드 없음";
  const activeMemberCount = getMemberCount(activeDashboard);

  const handleMenuOpenChange = (nextOpen: boolean) => {
    setMenuOpen(nextOpen);
    if (!nextOpen) {
      setDraftName("");
    }
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateDashboard(name);
      setDraftName("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectDashboard = (dashboardId: Id) => {
    onSelectDashboard(dashboardId);
    setMenuOpen(false);
  };

  const handleDeleteRequest = (dashboard: Dashboard) => {
    setMenuOpen(false);
    setDeleteTarget(dashboard);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    await onDeleteDashboard(targetId);
  };

  return (
    <header className="sticky top-0 z-50 flex justify-between items-center p-4 pointer-events-none">
      <Dialog open={menuOpen} onOpenChange={handleMenuOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Dashboard menu"
            className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80 pointer-events-auto"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>대시보드 관리</DialogTitle>
            <DialogDescription>
              대시보드를 전환하고 만들거나 삭제할 수 있어요. 구성원이
              추가되면 (공유)로 표시돼요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium text-gray-500">
                대시보드 목록
              </div>
              <div className="grid gap-2">
                {dashboards === undefined ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 dark:border-gray-700">
                    대시보드를 불러오는 중...
                  </div>
                ) : dashboards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 dark:border-gray-700">
                    아직 대시보드가 없어요.
                  </div>
                ) : (
                  dashboards.map((dashboard) => {
                    const isActive = dashboard.id === activeDashboardId;
                    const isShared = getMemberCount(dashboard) > 0;

                    return (
                      <div
                        key={dashboard.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 transition",
                          isActive
                            ? "border-primary/40 bg-primary/10"
                            : "border-gray-200 bg-white/70 hover:bg-white/90 dark:border-gray-700/70 dark:bg-gray-900/20"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectDashboard(dashboard.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {dashboard.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              isShared
                                ? "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
                                : "border-gray-200/70 bg-gray-100 text-gray-500 dark:border-gray-600/60 dark:bg-gray-700/30 dark:text-gray-200"
                            )}
                          >
                            {isShared ? "공유" : "개인"}
                          </span>
                          {isActive ? (
                            <Check className="ml-auto size-4 text-primary" />
                          ) : null}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete dashboard"
                          className="text-gray-500 hover:text-destructive"
                          onClick={() => handleDeleteRequest(dashboard)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200/80 bg-white/60 p-3 dark:border-gray-700/70 dark:bg-gray-900/20">
              <div className="text-xs font-medium text-gray-500">
                새 대시보드
              </div>
              <form onSubmit={handleCreateSubmit} className="mt-2 grid gap-2">
                <div className="grid gap-1">
                  <label className="text-[11px] text-gray-400">이름</label>
                  <input
                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="예: 패밀리 보드"
                    disabled={isCreating}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!draftName.trim() || isCreating}
                  >
                    {isCreating ? "생성 중..." : "생성"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border bg-white/60 backdrop-blur-[2px] hover:bg-white/80 shadow-sm px-6 py-2 rounded-full font-medium text-sm pointer-events-auto flex min-w-0 items-center gap-2 max-w-[60vw]">
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

      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Menu"
        className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80 pointer-events-auto"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>대시보드를 삭제할까요?</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {deleteTarget?.name}
              </div>
              <div>이 대시보드의 위젯과 기록이 모두 삭제됩니다.</div>
              {deleteTarget && getMemberCount(deleteTarget) > 0 ? (
                <div className="text-xs text-gray-400">
                  공유 대시보드는 멤버들과 공유된 데이터에도 영향을 줄 수
                  있어요.
                </div>
              ) : null}
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
