"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useDashboardWidgets } from "@/shared/db/queries";
import { commitWidgetLayout } from "@/shared/db/db";
import type { AppLanguage } from "@/shared/i18n/language";
import type { DashboardTemplate } from "@/feature/dashboard/libs/dashboardTemplates";
import {
  clearTemplateDashboardData,
  seedDashboardTemplate,
} from "@/feature/dashboard/libs/applyDashboardTemplate";
import GridLayout from "@/feature/dashboard/components/GridLayout";

type TemplateDashboardPreviewProps = {
  template: DashboardTemplate;
  language: AppLanguage;
};

export default function TemplateDashboardPreview({
  template,
  language,
}: TemplateDashboardPreviewProps) {
  const previewDashboardId = useMemo(
    () => `template-preview:${template.slug}`,
    [template.slug]
  );
  const previewKey = `${template.slug}:${language}`;
  const [seedState, setSeedState] = useState<{
    readyKey: string | null;
    failedKey: string | null;
  }>({
    readyKey: null,
    failedKey: null,
  });
  const widgets = useDashboardWidgets(previewDashboardId);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await clearTemplateDashboardData(previewDashboardId);
        if (!active) return;

        await seedDashboardTemplate({
          dashboardId: previewDashboardId,
          slug: template.slug,
          language,
          createdBy: "template-preview",
          skipOutbox: true,
        });

        if (!active) {
          await clearTemplateDashboardData(previewDashboardId);
          return;
        }

        setSeedState({
          readyKey: previewKey,
          failedKey: null,
        });
      } catch {
        if (!active) return;
        setSeedState((current) => ({
          readyKey:
            current.readyKey === previewKey ? null : current.readyKey,
          failedKey: previewKey,
        }));
      }
    })();

    return () => {
      active = false;
      void clearTemplateDashboardData(previewDashboardId);
    };
  }, [language, previewDashboardId, previewKey, template.slug]);

  const isReady = seedState.readyKey === previewKey && widgets !== undefined;
  const isError = seedState.failedKey === previewKey;

  if (!isReady && !isError) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border/80 bg-[linear-gradient(180deg,_rgba(255,251,245,0.96)_0%,_rgba(250,245,236,0.98)_100%)] p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <span>{language === "ko" ? "실제 대시보드 준비 중..." : "Preparing live dashboard..."}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {language === "ko"
          ? "실제 대시보드 미리보기를 불러오지 못했어요."
          : "Failed to load the live dashboard preview."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/80 bg-[linear-gradient(180deg,_rgba(255,251,245,0.96)_0%,_rgba(250,245,236,0.98)_100%)] py-3 shadow-sm">
        <div className="px-6 pb-2 text-xs text-muted-foreground">
          {language === "ko"
            ? "카드를 드래그해서 위치를 바꾸고, 모서리를 잡아 크기를 조정할 수 있어요."
            : "Drag cards to move them and resize from the corners."}
        </div>
        <div className="min-h-[760px]">
          <GridLayout
            widgets={widgets ?? []}
            onLayoutCommit={(nextWidgets) =>
              void commitWidgetLayout(nextWidgets, { skipOutbox: true })
            }
            canEditWidget={() => true}
            widgetContentClassName="pointer-events-none select-none"
          />
        </div>
      </div>
    </div>
  );
}
