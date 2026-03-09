"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { useDashboardWidgets, useDashboards } from "@/shared/db/queries";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";
import {
  dashboardTemplates,
  getLocalizedText,
  type DashboardTemplate,
} from "@/feature/dashboard/libs/dashboardTemplates";
import {
  applyDashboardTemplate,
  applyDashboardTemplateToExistingDashboard,
} from "@/feature/dashboard/libs/applyDashboardTemplate";
import { persistLastActiveDashboardId } from "@/feature/dashboard/libs/activeDashboardStorage";
import TemplateDashboardPreview from "./TemplateDashboardPreview";

type DashboardTemplateDetailPageProps = {
  template: DashboardTemplate;
};

export default function DashboardTemplateDetailPage({
  template,
}: DashboardTemplateDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  const { t, language } = useI18n();
  const dashboards = useDashboards();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const authEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const targetDashboardId = searchParams.get("dashboardId");
  const targetWidgets = useDashboardWidgets(targetDashboardId ?? undefined);
  const targetDashboard =
    dashboards?.find((dashboard) => dashboard.id === targetDashboardId) ?? null;
  const isResolvingTargetDashboard =
    Boolean(targetDashboardId) &&
    (dashboards === undefined || targetWidgets === undefined);
  const shouldApplyToExistingDashboard =
    Boolean(targetDashboardId) &&
    Boolean(targetDashboard) &&
    Array.isArray(targetWidgets) &&
    targetWidgets.length === 0;
  const templatesHubHref = targetDashboardId
    ? `/templates?dashboardId=${encodeURIComponent(targetDashboardId)}`
    : "/templates";
  const otherTemplates = dashboardTemplates.filter(
    (candidate) => candidate.slug !== template.slug,
  );

  const handleStart = async () => {
    if (authStatus === "loading" || isStarting || isResolvingTargetDashboard) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const dashboardId = shouldApplyToExistingDashboard && targetDashboardId
        ? await applyDashboardTemplateToExistingDashboard({
            dashboardId: targetDashboardId,
            slug: template.slug,
            language,
          })
        : await applyDashboardTemplate({
            slug: template.slug,
            language,
          });

      persistLastActiveDashboardId(dashboardId, authEmail);
      router.push("/");
    } catch (err) {
      const message =
        err instanceof Error
          ? localizeErrorMessage(err.message, t)
          : t(
              shouldApplyToExistingDashboard
                ? "템플릿을 현재 대시보드에 적용하지 못했어요."
                : "템플릿 대시보드를 생성하지 못했어요.",
              shouldApplyToExistingDashboard
                ? "Failed to apply the template to the current dashboard."
                : "Failed to create the template dashboard.",
            );
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(191,126,71,0.10),_transparent_38%),linear-gradient(180deg,_rgba(251,248,241,1)_0%,_rgba(246,240,229,1)_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <Button
            asChild
            variant="ghost"
            className="px-0 text-sm text-muted-foreground"
          >
            <Link href="/">
              <ArrowLeft className="size-4" />
              {t("홈으로 돌아가기", "Back to home")}
            </Link>
          </Button>
          <div className="rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-medium text-primary shadow-sm">
            {getLocalizedText(template.eyebrow, language)}
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-border/80 bg-card/90 p-6 shadow-[0_20px_60px_rgba(72,52,32,0.08)] backdrop-blur sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_340px] lg:items-start">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
                  {getLocalizedText(template.name, language)}
                </div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {getLocalizedText(template.headline, language)}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {getLocalizedText(template.summary, language)}
                </p>
              </div>
            </div>

            <aside className="rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,_rgba(250,244,233,0.96)_0%,_rgba(245,236,220,0.98)_100%)] p-5 text-foreground shadow-[0_16px_40px_rgba(72,52,32,0.10)]">
              <div className="text-sm font-medium text-primary">
                {shouldApplyToExistingDashboard
                  ? t("현재 대시보드에 적용", "Apply to current dashboard")
                  : t("이 템플릿으로 시작", "Start with this template")}
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {shouldApplyToExistingDashboard
                  ? targetDashboard?.name
                  : getLocalizedText(template.dashboardName, language)}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {shouldApplyToExistingDashboard
                  ? t(
                      "이 비어 있는 대시보드에 템플릿 위젯과 예시 데이터가 바로 채워집니다.",
                      "This empty dashboard will be filled with the template widgets and sample data.",
                    )
                  : t(
                      "생성 후 홈으로 돌아가며, 방금 만든 템플릿 대시보드가 바로 열립니다.",
                      "After creation you return home and the new template dashboard opens immediately.",
                    )}
              </p>
              <Button
                type="button"
                className="mt-6 h-11 w-full"
                onClick={() => void handleStart()}
                disabled={
                  authStatus === "loading" ||
                  isStarting ||
                  isResolvingTargetDashboard
                }
              >
                {isStarting
                  ? shouldApplyToExistingDashboard
                    ? t("템플릿 적용 중...", "Applying template...")
                    : t("대시보드 생성 중...", "Creating dashboard...")
                  : shouldApplyToExistingDashboard
                    ? t(
                        "이 대시보드에 템플릿 적용하기",
                        "Apply this template to this dashboard",
                      )
                    : t("이 템플릿으로 시작하기", "Start with this template")}
              </Button>
              {error ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            {t("실제 시작 화면 미리보기", "Real starter dashboard preview")}
          </div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {shouldApplyToExistingDashboard
              ? t(
                  "이 템플릿을 적용하면 현재 대시보드가 아래와 같은 레이아웃으로 채워집니다.",
                  "Applying this template fills the current dashboard with a layout like the preview below.",
                )
              : t(
                  "이 템플릿으로 시작하면 아래와 같은 레이아웃으로 대시보드가 생성됩니다.",
                  "Starting this template creates a dashboard with a layout like the preview below.",
                )}
          </div>
          <div className="mt-5">
            <TemplateDashboardPreview template={template} language={language} />
          </div>
        </section>

        <section className="rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {t("다른 템플릿도 볼 수 있어요", "Explore other templates")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {t(
                  "상황에 맞는 시작 화면을 고르세요",
                  "Choose a starting point for your scenario",
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button
              asChild
              variant="ghost"
              className="px-0 text-sm text-muted-foreground"
            >
              <Link href={templatesHubHref}>
                {t("전체 템플릿 허브 보기", "Open templates hub")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {otherTemplates.map((otherTemplate) => (
              <Link
                key={otherTemplate.slug}
                href={
                  targetDashboardId
                    ? `/templates/${otherTemplate.slug}?dashboardId=${encodeURIComponent(
                        targetDashboardId,
                      )}`
                    : `/templates/${otherTemplate.slug}`
                }
                className="group rounded-2xl border border-border/80 bg-accent/50 p-5 transition hover:border-primary/35 hover:bg-card"
              >
                <div className="text-sm font-medium text-primary">
                  {getLocalizedText(otherTemplate.eyebrow, language)}
                </div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {getLocalizedText(otherTemplate.name, language)}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {getLocalizedText(otherTemplate.summary, language)}
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  {t("템플릿 보기", "View template")}
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
