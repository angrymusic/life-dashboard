"use client";

import type { FormEvent, RefObject } from "react";
import {
  ArrowRight,
  Check,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { Dashboard, Id } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";

type DashboardManagerDashboardListProps = {
  dashboards?: Dashboard[];
  activeDashboardId?: Id;
  editingDashboardId: Id | null;
  renameDraft: string;
  renameError: string | null;
  renameInputRef: RefObject<HTMLInputElement | null>;
  draftName: string;
  hasRenameRestriction: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  isCreating: boolean;
  isCreateFormOpen: boolean;
  onSelectDashboard: (dashboardId: Id) => void;
  onRenameStart: (dashboard: Dashboard) => void;
  onRenameCancel: () => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRenameDraftChange: (value: string) => void;
  onCreateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftNameChange: (value: string) => void;
  onOpenCreateForm: () => void;
  onCloseCreateForm: () => void;
  onDeleteRequest: (dashboard: Dashboard) => void;
  onLeaveRequest: (dashboard: Dashboard) => void;
  onOpenTemplatesHub: () => void;
  canRenameDashboard: (dashboard?: Dashboard) => boolean;
  canDeleteDashboard: (dashboard?: Dashboard) => boolean;
  canLeaveDashboard: (dashboard?: Dashboard) => boolean;
};

type DashboardRowProps = {
  dashboard: Dashboard;
  isActive: boolean;
  isEditing: boolean;
  renameDraft: string;
  renameError: string | null;
  renameInputRef: RefObject<HTMLInputElement | null>;
  isRenaming: boolean;
  isDeleting: boolean;
  onSelectDashboard: (dashboardId: Id) => void;
  onRenameStart: (dashboard: Dashboard) => void;
  onRenameCancel: () => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRenameDraftChange: (value: string) => void;
  onDeleteRequest: (dashboard: Dashboard) => void;
  onLeaveRequest: (dashboard: Dashboard) => void;
  canRename: boolean;
  canDelete: boolean;
  canLeave: boolean;
};

function DashboardRow({
  dashboard,
  isActive,
  isEditing,
  renameDraft,
  renameError,
  renameInputRef,
  isRenaming,
  isDeleting,
  onSelectDashboard,
  onRenameStart,
  onRenameCancel,
  onRenameSubmit,
  onRenameDraftChange,
  onDeleteRequest,
  onLeaveRequest,
  canRename,
  canDelete,
  canLeave,
}: DashboardRowProps) {
  const { t } = useI18n();
  const isShared = Boolean(dashboard.groupId);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition sm:flex-nowrap",
        isActive
          ? "border-primary/40 bg-primary/10"
          : "border-gray-200 bg-white/70 hover:bg-white/90 dark:border-gray-700/70 dark:bg-gray-900/20"
      )}
    >
      {isEditing ? (
        <form
          onSubmit={onRenameSubmit}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap"
        >
          <div className="min-w-0 flex-1">
            <input
              ref={renameInputRef}
              value={renameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onRenameCancel();
                }
              }}
              className="w-full min-w-[120px] rounded-md border border-gray-300 bg-transparent px-2 py-1 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
              aria-label={t("대시보드 이름", "Dashboard name")}
              aria-invalid={renameError ? "true" : "false"}
              title={renameError ?? undefined}
              disabled={isRenaming}
            />
            {renameError ? (
              <div className="mt-1 text-[10px] text-red-500">{renameError}</div>
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
            onClick={onRenameCancel}
            disabled={isRenaming}
          >
            <X className="size-4" />
          </Button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelectDashboard(dashboard.id)}
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
            {isActive ? <Check className="ml-auto size-4 text-primary" /> : null}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Rename dashboard"
            className="text-gray-500 hover:text-gray-700"
            onClick={() => onRenameStart(dashboard)}
            disabled={!canRename}
          >
            <Pencil className="size-4" />
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete dashboard"
              className="text-gray-500 hover:text-destructive"
              onClick={() => onDeleteRequest(dashboard)}
              disabled={isDeleting}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : canLeave ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Leave dashboard"
              className="text-gray-500 hover:text-amber-700"
              onClick={() => onLeaveRequest(dashboard)}
              disabled={isDeleting}
            >
              <LogOut className="size-4" />
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function DashboardManagerDashboardList({
  dashboards,
  activeDashboardId,
  editingDashboardId,
  renameDraft,
  renameError,
  renameInputRef,
  draftName,
  hasRenameRestriction,
  isRenaming,
  isDeleting,
  isCreating,
  isCreateFormOpen,
  onSelectDashboard,
  onRenameStart,
  onRenameCancel,
  onRenameSubmit,
  onRenameDraftChange,
  onCreateSubmit,
  onDraftNameChange,
  onOpenCreateForm,
  onCloseCreateForm,
  onDeleteRequest,
  onLeaveRequest,
  onOpenTemplatesHub,
  canRenameDashboard,
  canDeleteDashboard,
  canLeaveDashboard,
}: DashboardManagerDashboardListProps) {
  const { t } = useI18n();

  return (
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
          dashboards.map((dashboard) => (
            <DashboardRow
              key={dashboard.id}
              dashboard={dashboard}
              isActive={dashboard.id === activeDashboardId}
              isEditing={editingDashboardId === dashboard.id}
              renameDraft={renameDraft}
              renameError={renameError}
              renameInputRef={renameInputRef}
              isRenaming={isRenaming}
              isDeleting={isDeleting}
              onSelectDashboard={onSelectDashboard}
              onRenameStart={onRenameStart}
              onRenameCancel={onRenameCancel}
              onRenameSubmit={onRenameSubmit}
              onRenameDraftChange={onRenameDraftChange}
              onDeleteRequest={onDeleteRequest}
              onLeaveRequest={onLeaveRequest}
              canRename={canRenameDashboard(dashboard)}
              canDelete={canDeleteDashboard(dashboard)}
              canLeave={canLeaveDashboard(dashboard)}
            />
          ))
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
                onClick={onCloseCreateForm}
                disabled={isCreating}
              >
                <X className="size-4" />
              </Button>
            </div>
            <form onSubmit={onCreateSubmit} className="mt-3 grid gap-3">
              <div className="grid gap-1">
                <label className="text-[11px] text-gray-400">{t("이름", "Name")}</label>
                <input
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                  value={draftName}
                  onChange={(event) => onDraftNameChange(event.target.value)}
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
                    onClick={onCloseCreateForm}
                    disabled={isCreating}
                  >
                    {t("취소", "Cancel")}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!draftName.trim() || isCreating}
                  >
                    {isCreating
                      ? t("생성 중...", "Creating...")
                      : t("생성", "Create")}
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
                onClick={onOpenCreateForm}
                disabled={isCreating || dashboards === undefined}
              >
                <Plus className="size-4" />
                {t("추가", "Add")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border/80 bg-accent/55 p-3">
          <div className="text-sm leading-6 text-foreground/85">
            {t(
              "🙋🏼 어떻게 시작해야 할지 모르겠나요? 템플릿으로 시작해보세요.",
              "🙋🏼 Not sure where to start? Try starting from a template."
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between border-border/80 bg-card/80 text-foreground hover:bg-card"
            onClick={onOpenTemplatesHub}
          >
            <span>{t("템플릿 허브 열기", "Open templates hub")}</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
