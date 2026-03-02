"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";
import GuestOnboardingTutorial from "./GuestOnboardingTutorial";
import { Button } from "@/shared/ui/button";
import type { Dashboard, Id, Widget } from "@/shared/db/schema";
import type { AddableWidgetType } from "@/feature/dashboard/libs/widgetRegistry";
import { useI18n } from "@/shared/i18n/client";
import type { WidgetLockMap } from "@/feature/dashboard/types/widgetLock";

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
  dialogOpen: boolean;
  dashboardError: string | null;
  isCreating: boolean;
  isRefreshingDashboards: boolean;
  onSelectDashboard: (dashboardId: Id) => void;
  onCreateDashboard: (name: string) => Promise<void>;
  onRenameDashboard: (dashboardId: Id, name: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: Id) => Promise<void>;
  onLeaveDashboard: (dashboardId: Id) => Promise<void>;
  onLayoutCommit: (nextWidgets: Widget[]) => Promise<void>;
  lockEnabled: boolean;
  widgetLocks: WidgetLockMap;
  onTouchWidgetLock: (widgetId: Id) => void;
  onReleaseAllWidgetLocks: () => void;
  onRefreshDashboards: () => Promise<void>;
  onRetryCreateDashboard: () => void;
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
  dialogOpen,
  dashboardError,
  isCreating,
  isRefreshingDashboards,
  onSelectDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
  onLeaveDashboard,
  onLayoutCommit,
  lockEnabled,
  widgetLocks,
  onTouchWidgetLock,
  onReleaseAllWidgetLocks,
  onRefreshDashboards,
  onRetryCreateDashboard,
  onCopyCurrentLink,
  onOpenAddDialog,
  onAddWidget,
}: DashboardViewProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const isOAuthCallbackError = searchParams.get("error") === "OAuthCallback";
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollToBottomVisibility = useCallback(() => {
    if (typeof window === "undefined") return;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const viewportBottom = window.scrollY + window.innerHeight;
    const canScroll = documentHeight > window.innerHeight + 8;
    const distanceToBottom = documentHeight - viewportBottom;
    const nextVisible = canScroll && distanceToBottom > 96;

    setShowScrollToBottom((current) =>
      current === nextVisible ? current : nextVisible
    );
  }, []);

  const scrollToBottom = useCallback(() => {
    if (typeof window === "undefined") return;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    window.scrollTo({
      top: documentHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("scroll", updateScrollToBottomVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollToBottomVisibility);

    return () => {
      window.removeEventListener("scroll", updateScrollToBottomVisibility);
      window.removeEventListener("resize", updateScrollToBottomVisibility);
    };
  }, [updateScrollToBottomVisibility]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(updateScrollToBottomVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [widgets?.length, dashboardId, updateScrollToBottomVisibility]);

  return (
    <div>
      <Header
        dashboards={dashboards}
        activeDashboardId={dashboardId}
        onSelectDashboard={onSelectDashboard}
        onCreateDashboard={onCreateDashboard}
        onRenameDashboard={onRenameDashboard}
        onDeleteDashboard={onDeleteDashboard}
        onLeaveDashboard={onLeaveDashboard}
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

      {activeDashboard?.groupId && !isSignedIn ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {t(
            "공유 대시보드는 로그인 후 편집할 수 있어요.",
            "You can edit shared dashboards after signing in."
          )}
        </div>
      ) : null}

      {isOAuthCallbackError ? (
        <div className="mx-4 mt-3 rounded-lg border border-red-200/70 bg-red-50 px-4 py-3 text-xs text-red-700">
          {t(
            "로그인 실패했습니다. 다시 시도하세요.",
            "Sign-in failed. Please try again."
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
          lockEnabled={lockEnabled}
          widgetLocks={widgetLocks}
          onTouchWidgetLock={onTouchWidgetLock}
          onReleaseAllWidgetLocks={onReleaseAllWidgetLocks}
        />
      )}

      {showScrollToBottom ? (
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={t("맨 아래로 이동", "Scroll to bottom")}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white/70 backdrop-blur-[2px] shadow-sm hover:bg-white/90"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      ) : null}

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
