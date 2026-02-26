"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardView from "./DashboardView";
import { useDashboards, useDashboardWidgets } from "@/shared/db/queries";
import { useSession } from "next-auth/react";
import { useDashboardBootstrapping } from "@/feature/dashboard/hooks/useDashboardBootstrapping";
import { useDashboardPermissions } from "@/feature/dashboard/hooks/useDashboardPermissions";
import { useDashboardSync } from "@/feature/dashboard/hooks/useDashboardSync";
import { useDashboardActions } from "@/feature/dashboard/hooks/useDashboardActions";
import { detectInAppBrowser } from "@/shared/lib/inAppBrowser";
import { useWidgetLocks } from "@/feature/dashboard/hooks/useWidgetLocks";

export default function DashboardContainer() {
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

  useEffect(() => {
    if (!pendingRemoteUpdate) return;

    const timeoutId = window.setTimeout(() => {
      void applyRemoteUpdate();
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingRemoteUpdate, applyRemoteUpdate]);

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

  const { lockEnabled, widgetLocks, touchWidgetLock, releaseAllWidgetLocks } =
    useWidgetLocks({
      activeDashboard,
      isSignedIn,
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

  const handleAddWidget: typeof addWidget = useCallback(
    async (type) => {
      await addWidget(type);
      if (typeof window === "undefined") return;

      const scrollToBottom = () => {
        const documentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        window.scrollTo({
          top: documentHeight,
          behavior: "smooth",
        });
      };

      window.requestAnimationFrame(() => {
        scrollToBottom();
        window.requestAnimationFrame(scrollToBottom);
      });
    },
    [addWidget]
  );

  return (
    <DashboardView
      dashboards={dashboards}
      dashboardId={dashboardId}
      activeDashboard={activeDashboard}
      widgets={widgets}
      canCreateWidget={canCreateWidget}
      canEditWidget={canEditWidget}
      isSignedIn={isSignedIn}
      isAuthLoading={isAuthLoading}
      isInAppBrowser={isInAppBrowser}
      copyStatus={copyStatus}
      dialogOpen={dialogOpen}
      dashboardError={dashboardError}
      isCreating={isCreating}
      isRefreshingDashboards={isRefreshingDashboards}
      onSelectDashboard={setActiveDashboardIdByUser}
      onCreateDashboard={createDashboard}
      onRenameDashboard={renameDashboard}
      onDeleteDashboard={deleteDashboard}
      onLayoutCommit={commitWidgetLayout}
      lockEnabled={lockEnabled}
      widgetLocks={widgetLocks}
      onTouchWidgetLock={touchWidgetLock}
      onReleaseAllWidgetLocks={releaseAllWidgetLocks}
      onRefreshDashboards={refreshDashboards}
      onRetryCreateDashboard={retry}
      onCopyCurrentLink={handleCopyCurrentLink}
      onOpenAddDialog={setDialogOpen}
      onAddWidget={handleAddWidget}
    />
  );
}
