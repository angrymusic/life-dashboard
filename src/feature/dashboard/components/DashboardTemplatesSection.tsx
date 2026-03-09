"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { Id } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";
import {
  dashboardTemplates,
  getLocalizedText,
} from "@/feature/dashboard/libs/dashboardTemplates";

const DASHBOARD_TEMPLATES_DISMISSED_KEY_PREFIX =
  "lifedashboard.dashboardTemplatesSection.dismissed";

function getDismissedStorageKey(dashboardId: Id) {
  return `${DASHBOARD_TEMPLATES_DISMISSED_KEY_PREFIX}:${dashboardId}`;
}

type DashboardTemplatesSectionProps = {
  dashboardId: Id;
};

export default function DashboardTemplatesSection({
  dashboardId,
}: DashboardTemplatesSectionProps) {
  const { language, t } = useI18n();
  const [isDismissed, setIsDismissed] = useState(false);
  const templatesHubHref = `/templates?dashboardId=${encodeURIComponent(
    dashboardId
  )}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      setIsDismissed(
        window.localStorage.getItem(getDismissedStorageKey(dashboardId)) === "1"
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [dashboardId]);

  const dismissSection = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getDismissedStorageKey(dashboardId), "1");
    }
    setIsDismissed(true);
  }, [dashboardId]);

  if (isDismissed) return null;

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-border/80 bg-[linear-gradient(135deg,_rgba(255,252,246,0.96)_0%,_rgba(248,243,232,0.92)_100%)] p-6 shadow-[0_18px_50px_rgba(72,52,32,0.06)] sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            {t("템플릿으로 시작", "Start from templates")}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-full text-muted-foreground"
            aria-label={t("템플릿 추천 닫기", "Dismiss template suggestions")}
            onClick={dismissSection}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t(
                "이 대시보드는 아직 비어 있어요. 템플릿으로 바로 시작하세요",
                "This dashboard is still empty. Start with a ready-made template"
              )}
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {t(
                "가족, 개인, 커플 시나리오 예시를 보고 지금 대시보드에 맞는 시작점을 고를 수 있어요.",
                "Browse family, personal, and couple examples, then pick a starting point for this dashboard."
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={templatesHubHref}>
              {t("모든 템플릿 보기", "See all templates")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {dashboardTemplates.map((template) => (
            <Link
              key={template.slug}
              href={`/templates/${template.slug}?dashboardId=${encodeURIComponent(
                dashboardId
              )}`}
              className="group rounded-[24px] border border-border/80 bg-card/90 p-5 transition hover:border-primary/35 hover:bg-card"
            >
              <div className="text-sm font-medium text-primary">
                {getLocalizedText(template.eyebrow, language)}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {getLocalizedText(template.name, language)}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {getLocalizedText(template.summary, language)}
              </p>
              <div className="mt-4 text-sm leading-6 text-foreground/80">
                {getLocalizedText(template.audience, language)}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                {t("템플릿 살펴보기", "Explore template")}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
