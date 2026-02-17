"use client";

import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";
import GuestOnboardingTutorial from "./GuestOnboardingTutorial";
import { Button } from "@/shared/ui/button";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import type { AddableWidgetType } from "@/feature/dashboard/libs/widgetRegistry";
import { useI18n } from "@/shared/i18n/client";

type CopyStatus = "idle" | "success" | "error";

type DashboardViewProps = {
  dashboards?: Dashboard[];
  dashboardId?: Id;
  activeDashboard?: Dashboard;
  widgets?: Widget[];
  canCreateWidget: boolean;
  canEditWidget: (widget: Widget) => boolean;
  isSignedIn: boolean;
  isAuthLoading: boolean;
  isInAppBrowser: boolean;
  copyStatus: CopyStatus;
  pendingRemoteUpdate: string | null;
  dialogOpen: boolean;
  dashboardError: string | null;
  isCreating: boolean;
  isRefreshingDashboards: boolean;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
  onLayoutCommit: (nextWidgets: Widget[]) => Promise<void>;
  onRefreshDashboards: () => Promise<void>;
  onRetryCreateDashboard: () => void;
  onApplyRemoteUpdate: () => Promise<void>;
  onCopyCurrentLink: () => Promise<void>;
  onOpenAddDialog: (open: boolean) => void;
  onAddWidget: (type: AddableWidgetType) => Promise<void>;
};

export default function DashboardView({
  dashboards,
  dashboardId,
  activeDashboard,
  widgets,
  canCreateWidget,
  canEditWidget,
  isSignedIn,
  isAuthLoading,
  isInAppBrowser,
  copyStatus,
  pendingRemoteUpdate,
  dialogOpen,
  dashboardError,
  isCreating,
  isRefreshingDashboards,
  onSelectDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
  onLayoutCommit,
  onRefreshDashboards,
  onRetryCreateDashboard,
  onApplyRemoteUpdate,
  onCopyCurrentLink,
  onOpenAddDialog,
  onAddWidget,
}: DashboardViewProps) {
  const { t } = useI18n();

  return (
    <div>
      <Header
        dashboards={dashboards}
        activeDashboardId={dashboardId}
        onSelectDashboard={onSelectDashboard}
        onCreateDashboard={onCreateDashboard}
        onRenameDashboard={onRenameDashboard}
        onDeleteDashboard={onDeleteDashboard}
        onRefreshDashboards={onRefreshDashboards}
        isRefreshingDashboards={isRefreshingDashboards}
      />

      {isInAppBrowser && !isSignedIn ? (
        <div className="mx-4 -mt-1 mb-2 rounded-md border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-xs text-amber-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t(
                "인앱 브라우저 접속 중입니다. Google 로그인은 기본 브라우저로 연 뒤 진행해 주세요.",
                "You are in an in-app browser. Open this page in your default browser to sign in with Google."
              )}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-white/80 px-2 text-[11px] text-amber-800 hover:bg-white"
              onClick={() => void onCopyCurrentLink()}
            >
              {t("링크 복사", "Copy link")}
            </Button>
          </div>
          {copyStatus === "success" ? (
            <div className="mt-1 text-[11px] text-amber-700">
              {t(
                "링크를 복사했어요. 사용하시는 브라우저로 열어주세요.",
                "Link copied. Open it in your browser."
              )}
            </div>
          ) : null}
          {copyStatus === "error" ? (
            <div className="mt-1 text-[11px] text-amber-700">
              {t(
                "자동 복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.",
                "Automatic copy failed. Please copy the URL from the address bar."
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeDashboard?.groupId && isSignedIn && pendingRemoteUpdate ? (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:max-w-md">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-primary/20 bg-accent/40 px-4 py-2 text-xs text-accent-foreground shadow-lg backdrop-blur-sm">
            <span>{t("새로운 변경사항이 있어요.", "There are new changes.")}</span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-primary/30 bg-white/70 text-primary shadow-none hover:bg-white hover:text-primary"
              onClick={() => void onApplyRemoteUpdate()}
            >
              {t("새로고침", "Refresh")}
            </Button>
          </div>
        </div>
      ) : null}

      {activeDashboard?.groupId && !isSignedIn ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {t(
            "공유 대시보드는 로그인 후 편집할 수 있어요.",
            "You can edit shared dashboards after signing in."
          )}
        </div>
      ) : null}

      {!dashboardId ? (
        <div className="p-6 text-sm">
          {dashboardError ? (
            <div className="space-y-3 text-red-600">
              <div>{t("대시보드를 생성하지 못했어요.", "Failed to create dashboard.")}</div>
              <Button variant="outline" size="sm" onClick={onRetryCreateDashboard}>
                {t("다시 시도", "Retry")}
              </Button>
            </div>
          ) : (
            <div className="text-gray-500">
              {isCreating
                ? t("대시보드 생성 중...", "Creating dashboard...")
                : t("대시보드를 불러오는 중...", "Loading dashboards...")}
            </div>
          )}
        </div>
      ) : !widgets ? (
        <div className="p-6 text-sm text-gray-400">Loading widgets...</div>
      ) : (
        <GridLayout
          widgets={widgets}
          onLayoutCommit={onLayoutCommit}
          canEditWidget={canEditWidget}
        />
      )}

      <Footer onAddClick={() => onOpenAddDialog(true)} canEdit={canCreateWidget} />

      <AddWidgetDialog
        open={dialogOpen}
        onOpenChange={onOpenAddDialog}
        onAdd={(type) => void onAddWidget(type)}
        disabled={!canCreateWidget}
      />

      <GuestOnboardingTutorial enabled={!isAuthLoading && !isSignedIn} />
    </div>
  );
}
