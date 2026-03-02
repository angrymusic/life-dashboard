"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, LogOut, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { useMembers } from "@/shared/db/queries";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";
import { useSession } from "next-auth/react";

type DashboardManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
  onLeaveDashboard: (dashboardId: Id) => Promise<void>;
  isSignedIn: boolean;
  onRefreshDashboards?: () => Promise<void>;
  isRefreshingDashboards?: boolean;
};

export default function DashboardManagerDialog({
  open,
  onOpenChange,
  dashboards,
  activeDashboardId,
  onSelectDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
  onLeaveDashboard,
  isSignedIn,
  onRefreshDashboards,
  isRefreshingDashboards,
}: DashboardManagerDialogProps) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const members = useMembers();
  const [draftName, setDraftName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingDashboardId, setEditingDashboardId] = useState<Id | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dashboard | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<Dashboard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  const canDelete = (dashboards?.length ?? 0) > 1;
  const roleByGroupId = useMemo(() => {
    if (!members || !sessionEmail) return new Map<string, string>();
    return members.reduce((acc, member) => {
      if (member.email?.trim().toLowerCase() !== sessionEmail) {
        return acc;
      }
      acc.set(member.groupId, member.role);
      return acc;
    }, new Map<string, string>());
  }, [members, sessionEmail]);
  const creatorEmailByGroupId = useMemo(() => {
    if (!members) return new Map<string, string>();
    const earliestByGroup = new Map<string, { createdAt: string; email: string }>();
    for (const member of members) {
      const normalizedEmail = member.email?.trim().toLowerCase();
      if (!normalizedEmail) continue;
      const existing = earliestByGroup.get(member.groupId);
      if (!existing || member.createdAt < existing.createdAt) {
        earliestByGroup.set(member.groupId, {
          createdAt: member.createdAt,
          email: normalizedEmail,
        });
      }
    }
    return new Map(
      [...earliestByGroup.entries()].map(([groupId, value]) => [groupId, value.email])
    );
  }, [members]);

  const isDashboardCreator = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
        (!dashboard.groupId ||
          (isSignedIn &&
            sessionEmail &&
            creatorEmailByGroupId.get(dashboard.groupId) &&
            creatorEmailByGroupId.get(dashboard.groupId) === sessionEmail))
    );

  const canRenameDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
        (!dashboard.groupId ||
          (isSignedIn && roleByGroupId.get(dashboard.groupId) === "parent"))
    );
  const canDeleteDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
        canDelete &&
        (!dashboard.groupId || isDashboardCreator(dashboard))
    );
  const canLeaveDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
        dashboard.groupId &&
        isSignedIn &&
        creatorEmailByGroupId.get(dashboard.groupId) &&
        !isDashboardCreator(dashboard)
    );
  const hasRenameRestriction =
    dashboards?.some(
      (dashboard) => Boolean(dashboard.groupId) && !canRenameDashboard(dashboard)
    ) ?? false;

  useEffect(() => {
    if (!editingDashboardId) return;
    if (dashboards?.some((dashboard) => dashboard.id === editingDashboardId)) {
      return;
    }
    setEditingDashboardId(null);
  }, [dashboards, editingDashboardId]);

  useEffect(() => {
    if (!editingDashboardId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingDashboardId]);

  useEffect(() => {
    if (open) return;
    setDraftName("");
    setIsCreateFormOpen(false);
    setEditingDashboardId(null);
    setRenameDraft("");
    setRenameError(null);
    setRefreshError(null);
    setDeleteError(null);
    setIsCreating(false);
    setIsRenaming(false);
    setIsDeleting(false);
  }, [open]);

  const handleRefreshDashboards = async () => {
    if (!onRefreshDashboards || isRefreshingDashboards) return;
    setRefreshError(null);
    try {
      await onRefreshDashboards();
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("목록 새로고침에 실패했어요.", "Failed to refresh dashboard list.");
      setRefreshError(message);
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
      setIsCreateFormOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectDashboard = (dashboardId: Id) => {
    onSelectDashboard(dashboardId);
    onOpenChange(false);
  };

  const handleDeleteRequest = (dashboard: Dashboard) => {
    if (!canDeleteDashboard(dashboard)) return;
    setDeleteError(null);
    onOpenChange(false);
    setDeleteTarget(dashboard);
  };

  const handleLeaveRequest = (dashboard: Dashboard) => {
    if (!canLeaveDashboard(dashboard)) return;
    setDeleteError(null);
    onOpenChange(false);
    setLeaveTarget(dashboard);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await onDeleteDashboard(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("삭제에 실패했어요.", "Failed to delete.");
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveConfirm = async () => {
    if (!leaveTarget || isDeleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await onLeaveDashboard(leaveTarget.id);
      setLeaveTarget(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("대시보드에서 나가지 못했어요.", "Failed to leave dashboard.");
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameStart = (dashboard: Dashboard) => {
    if (!canRenameDashboard(dashboard) || isRenaming) return;
    setEditingDashboardId(dashboard.id);
    setRenameDraft(dashboard.name);
    setRenameError(null);
  };

  const handleRenameCancel = () => {
    setEditingDashboardId(null);
    setRenameError(null);
    setRenameDraft("");
  };

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDashboardId) return;
    const target = dashboards?.find(
      (dashboard) => dashboard.id === editingDashboardId
    );
    if (!target) return;
    if (!canRenameDashboard(target) || isRenaming) return;

    const name = renameDraft.trim();
    if (!name) return;
    if (name === target.name) {
      setEditingDashboardId(null);
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    try {
      await onRenameDashboard(target.id, name);
      setEditingDashboardId(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t("이름 변경에 실패했어요.", "Failed to rename.");
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="gap-3 pr-8">
            <div className="flex items-center justify-start gap-4">
              <DialogTitle>{t("대시보드 목록", "Dashboards")}</DialogTitle>
              {onRefreshDashboards ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("대시보드 목록 새로고침", "Refresh dashboard list")}
                  onClick={() => void handleRefreshDashboards()}
                  disabled={
                    Boolean(isRefreshingDashboards) ||
                    Boolean(editingDashboardId) ||
                    isRenaming
                  }
                  className="h-7 gap-1 px-2 text-xs text-gray-600 hover:text-gray-800"
                >
                  <span>{t("새로고침", "Refresh")}</span>
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      isRefreshingDashboards ? "animate-spin" : ""
                    )}
                  />
                </Button>
              ) : null}
            </div>
            {refreshError ? (
              <div className="text-xs text-red-500">{refreshError}</div>
            ) : null}
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              {hasRenameRestriction ? (
                <div className="rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  {t(
                    "공유 대시보드 이름 변경은 관리자만 가능해요.",
                    "Only admins can rename shared dashboards."
                  )}
                </div>
              ) : null}
              <div className="grid gap-2">
                {dashboards === undefined ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 dark:border-gray-700">
                    {t("대시보드를 불러오는 중...", "Loading dashboards...")}
                  </div>
                ) : dashboards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 dark:border-gray-700">
                    {t("아직 대시보드가 없어요.", "No dashboards yet.")}
                  </div>
                ) : (
                  dashboards.map((dashboard) => {
                    const isActive = dashboard.id === activeDashboardId;
                    const isShared = Boolean(dashboard.groupId);
                    const isEditing = editingDashboardId === dashboard.id;
                    const canRenameRow = canRenameDashboard(dashboard);
                    const canDeleteRow = canDeleteDashboard(dashboard);
                    const canLeaveRow = canLeaveDashboard(dashboard);

                    return (
                      <div
                        key={dashboard.id}
                        className={cn(
                          "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition sm:flex-nowrap",
                          isActive
                            ? "border-primary/40 bg-primary/10"
                            : "border-gray-200 bg-white/70 hover:bg-white/90 dark:border-gray-700/70 dark:bg-gray-900/20"
                        )}
                      >
                        {isEditing ? (
                          <form
                            onSubmit={handleRenameSubmit}
                            className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap"
                          >
                            <div className="min-w-0 flex-1">
                              <input
                                ref={renameInputRef}
                                value={renameDraft}
                                onChange={(event) =>
                                  setRenameDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleRenameCancel();
                                  }
                                }}
                                className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-2 py-1 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                                aria-label={t("대시보드 이름", "Dashboard name")}
                                aria-invalid={renameError ? "true" : "false"}
                                title={renameError ?? undefined}
                                disabled={isRenaming}
                              />
                              {renameError ? (
                                <div className="mt-1 text-[10px] text-red-500">
                                  {renameError}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              type="submit"
                              size="icon-sm"
                              variant="outline"
                              disabled={!renameDraft.trim() || isRenaming}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={handleRenameCancel}
                              disabled={isRenaming}
                            >
                              <X className="size-4" />
                            </Button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectDashboard(dashboard.id)
                              }
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
                                {isShared ? t("공유", "Shared") : t("개인", "Personal")}
                              </span>
                              {isActive ? (
                                <Check className="ml-auto size-4 text-primary" />
                              ) : null}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Rename dashboard"
                              className="text-gray-500 hover:text-gray-700"
                              onClick={() => handleRenameStart(dashboard)}
                              disabled={!canRenameRow}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {canDeleteRow ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete dashboard"
                                className="text-gray-500 hover:text-destructive"
                                onClick={() => handleDeleteRequest(dashboard)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : canLeaveRow ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Leave dashboard"
                                className="text-gray-500 hover:text-amber-700"
                                onClick={() => handleLeaveRequest(dashboard)}
                                disabled={isDeleting}
                              >
                                <LogOut className="size-4" />
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })
                )}

                {isCreateFormOpen ? (
                  <div className="rounded-lg border border-gray-200/80 bg-white/60 p-3 dark:border-gray-700/70 dark:bg-gray-900/20">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-500">
                        {t("새 대시보드", "New dashboard")}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("새 대시보드 취소", "Cancel new dashboard")}
                        onClick={() => {
                          setIsCreateFormOpen(false);
                          setDraftName("");
                        }}
                        disabled={isCreating}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <form
                      onSubmit={handleCreateSubmit}
                      className="mt-3 grid gap-3"
                    >
                      <div className="grid gap-1">
                        <label className="text-[11px] text-gray-400">
                          {t("이름", "Name")}
                        </label>
                        <input
                          className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                          value={draftName}
                          onChange={(event) =>
                            setDraftName(event.target.value)
                          }
                          placeholder={t("예: 패밀리 보드", "e.g., Family board")}
                          autoFocus
                          disabled={isCreating}
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 text-[11px] text-gray-400">
                          {t(
                            "개인 대시보드는 언제든 이름을 바꿀 수 있고, 공유 대시보드는 관리자만 변경할 수 있어요.",
                            "Personal dashboards can be renamed anytime. Shared dashboards can be renamed by admins only."
                          )}
                        </span>
                        <div className="flex w-full justify-end gap-2 sm:w-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsCreateFormOpen(false);
                              setDraftName("");
                            }}
                            disabled={isCreating}
                          >
                            {t("취소", "Cancel")}
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!draftName.trim() || isCreating}
                          >
                            {isCreating ? t("생성 중...", "Creating...") : t("생성", "Create")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-200/70 bg-white/40 px-3 py-2 text-sm text-gray-600 dark:border-gray-700/70 dark:bg-gray-900/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-700 dark:text-gray-200">
                          {t("새 보드를 추가하세요", "Add a new board")}
                        </div>
                        <div className="text-xs text-gray-400">
                          {t(
                            "개인/공유 대시보드를 자유롭게 만들 수 있어요.",
                            "Create personal or shared dashboards freely."
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full gap-1 sm:w-auto"
                        onClick={() => setIsCreateFormOpen(true)}
                        disabled={isCreating || dashboards === undefined}
                      >
                        <Plus className="size-4" />
                        {t("추가", "Add")}
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("대시보드를 삭제할까요?", "Delete this dashboard?")}</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {deleteTarget?.name}
              </div>
              <div>
                {t(
                  "이 대시보드의 위젯과 기록이 모두 삭제됩니다.",
                  "All widgets and records in this dashboard will be deleted."
                )}
              </div>
              {deleteTarget?.groupId ? (
                <div className="text-xs text-gray-400">
                  {t(
                    "공유 대시보드는 멤버들과 공유된 데이터에도 영향을 줄 수 있어요.",
                    "Deleting a shared dashboard can affect data shared with members."
                  )}
                </div>
              ) : null}
              {deleteError ? (
                <div className="text-xs text-red-500">{deleteError}</div>
              ) : null}
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {t("취소", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting
                ? t("삭제 중...", "Deleting...")
                : t("삭제", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(leaveTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setLeaveTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("대시보드에서 나갈까요?", "Leave this dashboard?")}</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {leaveTarget?.name}
              </div>
              <div>
                {t(
                  "나가면 이 대시보드가 내 목록에서 사라져요.",
                  "This dashboard will be removed from your list after leaving."
                )}
              </div>
              {deleteError ? (
                <div className="text-xs text-red-500">{deleteError}</div>
              ) : null}
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveTarget(null)}
              disabled={isDeleting}
            >
              {t("취소", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLeaveConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? t("나가는 중...", "Leaving...") : t("나가기", "Leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
