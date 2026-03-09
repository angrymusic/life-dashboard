"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { useMembers } from "@/shared/db/queries";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";
import { useSession } from "next-auth/react";
import DashboardManagerDashboardList from "./DashboardManagerDashboardList";
import DashboardManagerConfirmDialog from "./DashboardManagerConfirmDialog";

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
  const router = useRouter();
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
    const earliestByGroup = new Map<
      string,
      { createdAt: string; email: string }
    >();
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
      [...earliestByGroup.entries()].map(([groupId, value]) => [
        groupId,
        value.email,
      ]),
    );
  }, [members]);

  const isDashboardCreator = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
      (!dashboard.groupId ||
        (isSignedIn &&
          sessionEmail &&
          creatorEmailByGroupId.get(dashboard.groupId) &&
          creatorEmailByGroupId.get(dashboard.groupId) === sessionEmail)),
    );

  const canRenameDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
      (!dashboard.groupId ||
        (isSignedIn && roleByGroupId.get(dashboard.groupId) === "parent")),
    );
  const canDeleteDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
      canDelete &&
      (!dashboard.groupId || isDashboardCreator(dashboard)),
    );
  const canLeaveDashboard = (dashboard?: Dashboard) =>
    Boolean(
      dashboard &&
      dashboard.groupId &&
      isSignedIn &&
      creatorEmailByGroupId.get(dashboard.groupId) &&
      !isDashboardCreator(dashboard),
    );
  const hasRenameRestriction =
    dashboards?.some(
      (dashboard) =>
        Boolean(dashboard.groupId) && !canRenameDashboard(dashboard),
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
          : t(
              "목록 새로고침에 실패했어요.",
              "Failed to refresh dashboard list.",
            );
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

  const handleOpenTemplatesHub = () => {
    onOpenChange(false);
    router.push("/templates");
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
      (dashboard) => dashboard.id === editingDashboardId,
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
                  aria-label={t(
                    "대시보드 목록 새로고침",
                    "Refresh dashboard list",
                  )}
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
                      isRefreshingDashboards ? "animate-spin" : "",
                    )}
                  />
                </Button>
              ) : null}
            </div>
            <DialogDescription>
              {t(
                "대시보드를 선택하고 새로 만들거나 이름을 바꾸고 삭제할 수 있어요. 템플릿으로 바로 시작할 수도 있어요.",
                "Select a dashboard, create a new one, rename it, or delete it. You can also start from a template.",
              )}
            </DialogDescription>
            {refreshError ? (
              <div className="text-xs text-red-500">{refreshError}</div>
            ) : null}
          </DialogHeader>
          <div className="grid gap-4">
            <DashboardManagerDashboardList
              dashboards={dashboards}
              activeDashboardId={activeDashboardId}
              editingDashboardId={editingDashboardId}
              renameDraft={renameDraft}
              renameError={renameError}
              renameInputRef={renameInputRef}
              draftName={draftName}
              hasRenameRestriction={hasRenameRestriction}
              isRenaming={isRenaming}
              isDeleting={isDeleting}
              isCreating={isCreating}
              isCreateFormOpen={isCreateFormOpen}
              onSelectDashboard={handleSelectDashboard}
              onRenameStart={handleRenameStart}
              onRenameCancel={handleRenameCancel}
              onRenameSubmit={handleRenameSubmit}
              onRenameDraftChange={setRenameDraft}
              onCreateSubmit={handleCreateSubmit}
              onDraftNameChange={setDraftName}
              onOpenCreateForm={() => setIsCreateFormOpen(true)}
              onCloseCreateForm={() => {
                setIsCreateFormOpen(false);
                setDraftName("");
              }}
              onDeleteRequest={handleDeleteRequest}
              onLeaveRequest={handleLeaveRequest}
              onOpenTemplatesHub={handleOpenTemplatesHub}
              canRenameDashboard={canRenameDashboard}
              canDeleteDashboard={canDeleteDashboard}
              canLeaveDashboard={canLeaveDashboard}
            />
          </div>
        </DialogContent>
      </Dialog>

      <DashboardManagerConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("대시보드를 삭제할까요?", "Delete this dashboard?")}
        name={deleteTarget?.name}
        description={t(
          "이 대시보드의 위젯과 기록이 모두 삭제됩니다.",
          "All widgets and records in this dashboard will be deleted."
        )}
        note={
          deleteTarget?.groupId
            ? t(
                "공유 대시보드는 멤버들과 공유된 데이터에도 영향을 줄 수 있어요.",
                "Deleting a shared dashboard can affect data shared with members."
              )
            : undefined
        }
        error={deleteError}
        cancelLabel={t("취소", "Cancel")}
        confirmLabel={t("삭제", "Delete")}
        confirmingLabel={t("삭제 중...", "Deleting...")}
        isPending={isDeleting}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />

      <DashboardManagerConfirmDialog
        open={Boolean(leaveTarget)}
        title={t("대시보드에서 나갈까요?", "Leave this dashboard?")}
        name={leaveTarget?.name}
        description={t(
          "나가면 이 대시보드가 내 목록에서 사라져요.",
          "This dashboard will be removed from your list after leaving."
        )}
        error={deleteError}
        cancelLabel={t("취소", "Cancel")}
        confirmLabel={t("나가기", "Leave")}
        confirmingLabel={t("나가는 중...", "Leaving...")}
        isPending={isDeleting}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setLeaveTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleLeaveConfirm}
      />
    </>
  );
}
