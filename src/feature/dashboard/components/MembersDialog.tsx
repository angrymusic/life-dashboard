"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { Dashboard, Member } from "@/shared/db/schema";
import {
  clearOutboxForDashboard,
  pushDashboardSnapshot,
  setDashboardGroupId,
  syncMembersFromServer,
} from "@/shared/db/db";

type MembersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDashboard?: Dashboard;
  members?: Member[];
  isSignedIn: boolean;
};

export default function MembersDialog({
  open,
  onOpenChange,
  activeDashboard,
  members,
  isSignedIn,
}: MembersDialogProps) {
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const activeMembers = useMemo(() => {
    if (!members || !activeDashboard?.groupId) return [];
    return members.filter((member) => member.groupId === activeDashboard.groupId);
  }, [members, activeDashboard?.groupId]);

  useEffect(() => {
    if (open) return;
    setMemberEmail("");
    setMemberError(null);
    setMemberSuccess(null);
    setIsAddingMember(false);
  }, [open]);

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDashboard) return;
    if (!isSignedIn) return;

    const email = memberEmail.trim();
    if (!email || isAddingMember) return;

    const wasPersonal = !activeDashboard.groupId;
    setIsAddingMember(true);
    setMemberError(null);
    setMemberSuccess(null);

    try {
      const response = await fetch(
        `/api/dashboards/${activeDashboard.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            dashboardName: activeDashboard.name,
          }),
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        dashboard?: { id: string; groupId: string; updatedAt: string };
        members?: unknown[];
      };

      if (!response.ok || !payload.ok) {
        setMemberError(payload.error ?? "구성원을 추가하지 못했어요.");
        return;
      }

      if (payload.dashboard?.groupId) {
        await setDashboardGroupId(
          {
            dashboardId: activeDashboard.id,
            groupId: payload.dashboard.groupId,
            updatedAt: payload.dashboard.updatedAt,
          },
          { skipOutbox: true }
        );
      }

      if (Array.isArray(payload.members)) {
        await syncMembersFromServer(
          payload.members as Member[],
          payload.dashboard?.groupId
        );
      }

      if (wasPersonal && payload.dashboard?.groupId) {
        await pushDashboardSnapshot(activeDashboard.id);
        await clearOutboxForDashboard(activeDashboard.id);
        setMemberSuccess(
          "구성원을 추가했어요. 이 대시보드는 공유로 전환되어 서버에서 관리돼요."
        );
      } else {
        setMemberSuccess("구성원을 추가했어요.");
      }

      setMemberEmail("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "구성원을 추가하지 못했어요.";
      setMemberError(message);
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>구성원</DialogTitle>
          <DialogDescription>
            현재 대시보드의 구성원을 관리할 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <div className="text-xs font-medium text-gray-500">
              구성원 관리
            </div>
            <div className="text-xs text-gray-500">
              구성원을 추가하면 공유 대시보드가 되고 서버에서 관리돼요.
            </div>
          </div>
          {!activeDashboard ? (
            <div className="text-sm text-gray-500">
              먼저 대시보드를 선택해주세요.
            </div>
          ) : !isSignedIn ? (
            <div className="text-sm text-gray-500">
              로그인 후 구성원을 추가할 수 있어요.
            </div>
          ) : (
            <form onSubmit={handleAddMember} className="grid gap-2">
              <div className="grid gap-1">
                <label className="text-[11px] text-gray-400">
                  Google 이메일
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="example@gmail.com"
                  disabled={isAddingMember}
                />
              </div>
              {memberError ? (
                <div className="text-xs text-red-500">{memberError}</div>
              ) : null}
              {memberSuccess ? (
                <div className="text-xs text-green-600">{memberSuccess}</div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!memberEmail.trim() || isAddingMember}
                >
                  {isAddingMember ? "추가 중..." : "추가"}
                </Button>
              </div>
            </form>
          )}
          <div className="grid gap-2">
            <div className="text-[11px] text-gray-400">현재 구성원</div>
            {activeMembers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-700">
                아직 구성원이 없어요.
              </div>
            ) : (
              activeMembers.map((member) => {
                const roleLabel =
                  member.role === "parent" ? "관리자" : "구성원";
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-xs text-gray-600 dark:border-gray-700/70 dark:bg-gray-900/20"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {member.displayName}
                    </span>
                    {member.email ? (
                      <span className="truncate text-gray-400">
                        {member.email}
                      </span>
                    ) : null}
                    <span className="ml-auto rounded-full border border-gray-200/70 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-600/60 dark:bg-gray-700/30 dark:text-gray-200">
                      {roleLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
