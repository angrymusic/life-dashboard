"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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
import type { Dashboard, Id } from "@/shared/db/schema";

type DashboardManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
  isSignedIn: boolean;
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
  isSignedIn,
}: DashboardManagerDialogProps) {
  const [draftName, setDraftName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editingDashboardId, setEditingDashboardId] = useState<Id | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dashboard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  const canDelete = (dashboards?.length ?? 0) > 1;
  const canRenameDashboard = (dashboard?: Dashboard) =>
    Boolean(dashboard && (!dashboard.groupId || isSignedIn));

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
    setIsCreating(false);
    setIsRenaming(false);
  }, [open]);

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
    onOpenChange(false);
    setDeleteTarget(dashboard);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    await onDeleteDashboard(targetId);
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
        err instanceof Error ? err.message : "이름 변경에 실패했어요.";
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>대시보드 관리</DialogTitle>
            <DialogDescription>
              대시보드를 전환하고 만들거나 삭제할 수 있어요.
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
                    const isShared = Boolean(dashboard.groupId);
                    const isEditing = editingDashboardId === dashboard.id;
                    const canRenameRow = canRenameDashboard(dashboard);

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
                                className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                                aria-label="대시보드 이름"
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
                              aria-label="Rename dashboard"
                              className="text-gray-500 hover:text-gray-700"
                              onClick={() => handleRenameStart(dashboard)}
                              disabled={!canRenameRow}
                            >
                              <Pencil className="size-4" />
                            </Button>
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
                        새 대시보드
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="새 대시보드 취소"
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
                          이름
                        </label>
                        <input
                          className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                          value={draftName}
                          onChange={(event) =>
                            setDraftName(event.target.value)
                          }
                          placeholder="예: 패밀리 보드"
                          autoFocus
                          disabled={isCreating}
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 text-[11px] text-gray-400">
                          나중에 언제든 이름을 바꿀 수 있어요.
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
                            취소
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!draftName.trim() || isCreating}
                          >
                            {isCreating ? "생성 중..." : "생성"}
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
                          새 보드를 추가하세요
                        </div>
                        <div className="text-xs text-gray-400">
                          개인/공유 대시보드를 자유롭게 만들 수 있어요.
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
                        추가
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
              {deleteTarget?.groupId ? (
                <div className="text-xs text-gray-400">
                  공유 대시보드는 멤버들과 공유된 데이터에도 영향을 줄 수
                  있어요.
                </div>
              ) : null}
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
