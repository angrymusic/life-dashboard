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
import type { Dashboard, Member, Role } from "@/shared/db/schema";
import {
  clearOutboxForDashboard,
  getLocalMembersGroupId,
  pushDashboardSnapshot,
  setDashboardGroupId,
  syncMembersFromServer,
} from "@/shared/db/db";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";
import { useSession } from "next-auth/react";

type RoleOption = {
  value: Role;
  label: string;
  summary: string;
  detail: string;
};

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
  const { t } = useI18n();
  const { data: session } = useSession();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("child");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(
    null
  );
  const roleOptions = useMemo<RoleOption[]>(
    () => [
      {
        value: "parent",
        label: t("관리자", "Admin"),
        summary: t("모든 위젯 편집 · 권한 관리", "Edit all widgets and manage roles"),
        detail: t(
          "생성/수정/삭제/이동/사이즈 조절",
          "Create / edit / delete / move / resize"
        ),
      },
      {
        value: "child",
        label: t("사용자", "Member"),
        summary: t(
          "위젯 생성 · 본인 위젯만 편집",
          "Create widgets and edit only own widgets"
        ),
        detail: t(
          "본인 위젯만 수정/삭제/이동/사이즈 조절",
          "Edit / delete / move / resize only own widgets"
        ),
      },
    ],
    [t]
  );

  const activeMembers = useMemo(() => {
    if (!members) return [];
    const dashboardId = activeDashboard?.id;
    const groupId =
      activeDashboard?.groupId ??
      (dashboardId ? getLocalMembersGroupId(dashboardId) : undefined);
    if (!groupId) return [];
    return members.filter((member) => member.groupId === groupId);
  }, [members, activeDashboard?.groupId, activeDashboard?.id]);

  const firstMemberId = useMemo(() => {
    if (activeMembers.length === 0) return undefined;
    return activeMembers.reduce((earliest, member) => {
      return member.createdAt < earliest.createdAt ? member : earliest;
    }, activeMembers[0]).id;
  }, [activeMembers]);

  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const currentMember = useMemo(() => {
    if (!sessionEmail) return undefined;
    return activeMembers.find(
      (member) => member.email?.trim().toLowerCase() === sessionEmail
    );
  }, [activeMembers, sessionEmail]);
  const isAdmin = !activeDashboard?.groupId || currentMember?.role === "parent";
  const canManageMembers = Boolean(isSignedIn && isAdmin);
  const canUpdateRoles = Boolean(canManageMembers && activeDashboard?.groupId);

  useEffect(() => {
    if (open) return;
    setMemberEmail("");
    setMemberRole("child");
    setMemberError(null);
    setMemberSuccess(null);
    setRoleUpdateError(null);
    setIsAddingMember(false);
    setRoleUpdatingId(null);
    setRemovingMemberId(null);
    setRemoveMemberError(null);
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
            role: memberRole,
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
        const message =
          typeof payload.error === "string" && payload.error
            ? localizeErrorMessage(payload.error, t)
            : t("구성원을 추가하지 못했어요.", "Failed to add member.");
        setMemberError(message);
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
          t(
            "구성원을 추가했어요. 이 대시보드는 공유로 전환되어 서버에서 관리돼요.",
            "Member added. This dashboard is now shared and managed on the server."
          )
        );
      } else {
        setMemberSuccess(t("구성원을 추가했어요.", "Member added."));
      }

      setMemberEmail("");
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("구성원을 추가하지 못했어요.", "Failed to add member.");
      setMemberError(message);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRoleChange = async (member: Member, nextRole: Role) => {
    if (!activeDashboard?.groupId) return;
    if (!canUpdateRoles) return;
    if (member.id === firstMemberId) return;
    if (member.role === nextRole) return;

    setRoleUpdateError(null);
    setRoleUpdatingId(member.id);

    try {
      const response = await fetch(
        `/api/dashboards/${activeDashboard.id}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: member.id, role: nextRole }),
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        members?: unknown[];
      };

      if (!response.ok || !payload.ok) {
        const message =
          typeof payload.error === "string" && payload.error
            ? localizeErrorMessage(payload.error, t)
            : t("권한을 변경하지 못했어요.", "Failed to update role.");
        setRoleUpdateError(message);
        return;
      }

      if (Array.isArray(payload.members)) {
        await syncMembersFromServer(payload.members as Member[]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("권한을 변경하지 못했어요.", "Failed to update role.");
      setRoleUpdateError(message);
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!activeDashboard?.groupId) return;
    if (!canUpdateRoles) return;
    if (member.id === firstMemberId) return;
    if (member.userId && member.userId === currentMember?.userId) return;

    setRemoveMemberError(null);
    setRemovingMemberId(member.id);

    try {
      const response = await fetch(
        `/api/dashboards/${activeDashboard.id}/members`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: member.id }),
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        members?: unknown[];
      };

      if (!response.ok || !payload.ok) {
        const message =
          typeof payload.error === "string" && payload.error
            ? localizeErrorMessage(payload.error, t)
            : t("구성원을 퇴출하지 못했어요.", "Failed to remove member.");
        setRemoveMemberError(message);
        return;
      }

      if (Array.isArray(payload.members)) {
        await syncMembersFromServer(payload.members as Member[]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("구성원을 퇴출하지 못했어요.", "Failed to remove member.");
      setRemoveMemberError(message);
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("구성원", "Members")}</DialogTitle>
          <DialogDescription>
            {t(
              "현재 대시보드의 구성원을 관리할 수 있어요.",
              "Manage members of the current dashboard."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <div className="text-xs font-medium text-gray-500">
              {t("구성원 관리", "Member management")}
            </div>
            <div className="text-xs text-gray-500">
              {t(
                "구성원을 추가하면 공유 대시보드가 되고 서버에서 관리돼요.",
                "Adding a member turns this into a shared dashboard managed on the server."
              )}
            </div>
          </div>
          {!activeDashboard ? (
            <div className="text-sm text-gray-500">
              {t("먼저 대시보드를 선택해주세요.", "Select a dashboard first.")}
            </div>
          ) : !isSignedIn ? (
            <div className="text-sm text-gray-500">
              {t("로그인 후 구성원을 추가할 수 있어요.", "Sign in to add members.")}
            </div>
          ) : !canManageMembers ? (
            <div className="text-sm text-gray-500">
              {t(
                "관리자만 구성원을 추가하거나 권한을 변경할 수 있어요.",
                "Only admins can add members or change roles."
              )}
            </div>
          ) : (
            <form onSubmit={handleAddMember} className="grid gap-2">
              <div className="grid gap-1">
                <label className="text-[11px] text-gray-400">
                  {t("Google 이메일", "Google email")}
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="example@gmail.com"
                  disabled={isAddingMember}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[11px] text-gray-400">{t("권한", "Role")}</label>
                <div
                  className="grid gap-2 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label={t("권한", "Role")}
                >
                  {roleOptions.map((option) => {
                    const isSelected = memberRole === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setMemberRole(option.value)}
                        disabled={isAddingMember}
                        className={[
                          "rounded-lg border px-3 py-2 text-left transition",
                          isSelected
                            ? "border-gray-900 bg-gray-50/80"
                            : "border-gray-200 hover:border-gray-300",
                          "dark:border-gray-700 dark:bg-gray-900/20 dark:hover:border-gray-500",
                          isAddingMember ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {option.label}
                          </span>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px]",
                              isSelected
                                ? "bg-gray-900 text-white"
                                : "border border-gray-200 text-gray-400",
                              "dark:border-gray-600 dark:text-gray-300",
                            ].join(" ")}
                          >
                            {isSelected ? t("선택됨", "Selected") : t("선택", "Select")}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {option.summary}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {option.detail}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-gray-400">
                  {t("첫 생성자는 관리자 권한이 고정돼요.", "The first creator is always an admin.")}
                </div>
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
                  {isAddingMember ? t("추가 중...", "Adding...") : t("추가", "Add")}
                </Button>
              </div>
            </form>
          )}
          <div className="grid gap-2">
            <div className="text-[11px] text-gray-400">{t("현재 구성원", "Current members")}</div>
            {roleUpdateError ? (
              <div className="text-xs text-red-500">{roleUpdateError}</div>
            ) : null}
            {removeMemberError ? (
              <div className="text-xs text-red-500">{removeMemberError}</div>
            ) : null}
            {activeMembers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-700">
                {t("아직 구성원이 없어요.", "No members yet.")}
              </div>
            ) : (
              activeMembers.map((member) => {
                const roleLabel =
                  member.role === "parent" ? t("관리자", "Admin") : t("사용자", "Member");
                const isUpdating = roleUpdatingId === member.id;
                const isOwner = member.id === firstMemberId;
                const isSelf = Boolean(
                  (sessionEmail &&
                    member.email?.trim().toLowerCase() === sessionEmail) ||
                    (currentMember?.userId &&
                      member.userId === currentMember.userId)
                );
                const canChangeRole = canUpdateRoles && !isOwner;
                const canRemove = canUpdateRoles && !isOwner && !isSelf;
                const isRemoving = removingMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-xs text-gray-600 dark:border-gray-700/70 dark:bg-gray-900/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-700 dark:text-gray-200">
                        {member.displayName}
                      </div>
                      {member.email ? (
                        <div className="truncate text-gray-400">
                          {member.email}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
                      {canChangeRole ? (
                        <div
                          role="radiogroup"
                          aria-label={t("권한", "Role")}
                          className="inline-flex flex-wrap items-center rounded-full border border-gray-200/70 bg-gray-100/70 p-0.5 text-[10px] dark:border-gray-600/60 dark:bg-gray-700/30"
                        >
                          {roleOptions.map((option) => {
                            const isSelected = member.role === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() =>
                                  handleRoleChange(member, option.value)
                                }
                                disabled={isUpdating}
                                className={[
                                  "rounded-full px-2 py-0.5 whitespace-nowrap transition",
                                  isSelected
                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-100/10 dark:text-gray-100"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white",
                                  isUpdating
                                    ? "opacity-60 cursor-not-allowed"
                                    : "",
                                ].join(" ")}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="rounded-full border border-gray-200/70 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 whitespace-nowrap dark:border-gray-600/60 dark:bg-gray-700/30 dark:text-gray-200">
                          {isOwner ? t("관리자 · 고정", "Admin · fixed") : roleLabel}
                        </span>
                      )}
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          disabled={isRemoving}
                          className={[
                            "rounded-full border border-red-200/70 bg-red-50 px-2 py-0.5 text-[10px] text-red-600 transition",
                            "hover:border-red-300 hover:bg-red-100",
                            "dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300",
                            isRemoving ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                        >
                          {isRemoving ? t("퇴출 중...", "Removing...") : t("퇴출", "Remove")}
                        </button>
                      ) : null}
                    </div>
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
