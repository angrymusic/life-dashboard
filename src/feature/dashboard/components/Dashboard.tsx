"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GridLayout from "./GridLayout";
import { AddWidgetDialog } from "./AddWidgetDialog";
import GuestOnboardingTutorial from "./GuestOnboardingTutorial";
import { useDashboards, useDashboardWidgets } from "@/shared/db/queries";
import { Button } from "@/shared/ui/button";
import { useSession } from "next-auth/react";
import { useDashboardBootstrapping } from "@/feature/dashboard/hooks/useDashboardBootstrapping";
import { useDashboardPermissions } from "@/feature/dashboard/hooks/useDashboardPermissions";
import { useDashboardSync } from "@/feature/dashboard/hooks/useDashboardSync";
import { useDashboardActions } from "@/feature/dashboard/hooks/useDashboardActions";
import { detectInAppBrowser } from "@/shared/lib/inAppBrowser";

export default function Dashboard() {
  const dashboards = useDashboards();
  const { data: session, status: authStatus } = useSession();
  const isSignedIn = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";
  const authEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  const {
    activeDashboardId,
    setActiveDashboardIdByUser,
    dashboardError,
    isCreating,
    isServerBootstrapReady,
    retry,
    refreshDashboards,
    isRefreshingDashboards,
  } = useDashboardBootstrapping({
    dashboards,
    authEmail,
    isSignedIn,
    isAuthLoading,
  });

  const dashboardId = activeDashboardId;
  const activeDashboard = dashboards?.find(
    (dashboard) => dashboard.id === dashboardId
  );

  const { canCreateWidget, canEditWidget, widgetCreatorId } =
    useDashboardPermissions({
      activeDashboard,
      authEmail,
      isSignedIn,
    });

  const widgets = useDashboardWidgets(dashboardId);

  const { pendingRemoteUpdate, applyRemoteUpdate } = useDashboardSync({
    activeDashboard,
    dashboardId,
    widgets,
    isSignedIn,
    isServerBootstrapReady,
  });

  const {
    addWidget,
    commitWidgetLayout,
    createDashboard,
    renameDashboard,
    deleteDashboard,
  } = useDashboardActions({
    dashboards,
    activeDashboardId: dashboardId,
    setActiveDashboardIdByUser,
    dashboardId,
    widgets,
    widgetCreatorId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsInAppBrowser(detectInAppBrowser(navigator.userAgent));
  }, []);

  const handleCopyCurrentLink = async () => {
    if (typeof window === "undefined") return;
    const currentUrl = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = currentUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("copy failed");
      }
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <div>
      <Header
        dashboards={dashboards}
        activeDashboardId={dashboardId}
        onSelectDashboard={setActiveDashboardIdByUser}
        onCreateDashboard={createDashboard}
        onRenameDashboard={renameDashboard}
        onDeleteDashboard={deleteDashboard}
        onRefreshDashboards={refreshDashboards}
        isRefreshingDashboards={isRefreshingDashboards}
      />

      {isInAppBrowser && !isSignedIn ? (
        <div className="mx-4 -mt-1 mb-2 rounded-md border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-xs text-amber-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              인앱 브라우저 접속 중입니다. Google 로그인은 기본 브라우저로 연 뒤 진행해 주세요.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-white/80 px-2 text-[11px] text-amber-800 hover:bg-white"
              onClick={() => void handleCopyCurrentLink()}
            >
              링크 복사
            </Button>
          </div>
          {copyStatus === "success" ? (
            <div className="mt-1 text-[11px] text-amber-700">
              링크를 복사했어요. 사용하시는 브라우저로 열어주세요.
            </div>
          ) : null}
          {copyStatus === "error" ? (
            <div className="mt-1 text-[11px] text-amber-700">
              자동 복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.
            </div>
          ) : null}
        </div>
      ) : null}

      {activeDashboard?.groupId && isSignedIn && pendingRemoteUpdate ? (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:max-w-md">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-primary/20 bg-accent/40 px-4 py-2 text-xs text-accent-foreground shadow-lg backdrop-blur-sm">
            <span>새로운 변경사항이 있어요.</span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-primary/30 bg-white/70 text-primary shadow-none hover:bg-white hover:text-primary"
              onClick={() => void applyRemoteUpdate()}
            >
              새로고침
            </Button>
          </div>
        </div>
      ) : null}

      {activeDashboard?.groupId && !isSignedIn ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          공유 대시보드는 로그인 후 편집할 수 있어요.
        </div>
      ) : null}

      {!dashboardId ? (
        <div className="p-6 text-sm">
          {dashboardError ? (
            <div className="space-y-3 text-red-600">
              <div>대시보드를 생성하지 못했어요.</div>
              <Button variant="outline" size="sm" onClick={retry}>
                다시 시도
              </Button>
            </div>
          ) : (
            <div className="text-gray-500">
              {isCreating
                ? "대시보드 생성 중..."
                : "대시보드를 불러오는 중..."}
            </div>
          )}
        </div>
      ) : !widgets ? (
        <div className="p-6 text-sm text-gray-400">Loading widgets...</div>
      ) : (
        <GridLayout
          widgets={widgets}
          onLayoutCommit={commitWidgetLayout}
          canEditWidget={canEditWidget}
        />
      )}

      <Footer onAddClick={() => setDialogOpen(true)} canEdit={canCreateWidget} />

      <AddWidgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(type) => void addWidget(type)}
        disabled={!canCreateWidget}
      />

      <GuestOnboardingTutorial enabled={!isAuthLoading && !isSignedIn} />
    </div>
  );
}
