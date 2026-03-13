"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useI18n } from "@/shared/i18n/client";
import {
  dashboardTemplates,
  getLocalizedText,
} from "@/feature/dashboard/libs/dashboardTemplates";

const faqs = [
  {
    key: "create",
    question: {
      ko: "템플릿을 시작하면 무엇이 생성되나요?",
      en: "What gets created when I start a template?",
    },
    answer: {
      ko: "새 대시보드가 하나 생성되고, 해당 시나리오에 맞는 위젯과 예시 데이터가 함께 들어갑니다.",
      en: "A new dashboard is created with widgets and example data for that scenario.",
    },
  },
  {
    key: "edit",
    question: {
      ko: "생성 후에 위젯을 수정하거나 삭제할 수 있나요?",
      en: "Can I edit or delete widgets after creation?",
    },
    answer: {
      ko: "네. 템플릿은 시작점일 뿐이라서, 생성 후에는 일반 대시보드처럼 자유롭게 바꿀 수 있어요.",
      en: "Yes. Templates are only a starting point, so you can change everything after creation.",
    },
  },
  {
    key: "choose",
    question: {
      ko: "어떤 템플릿을 고르면 되나요?",
      en: "How do I choose the right template?",
    },
    answer: {
      ko: "가족은 공유 일정과 집안 루틴, 개인은 혼자 쓰는 계획과 루틴, 커플은 둘이 함께 보는 일정과 기념일 중심으로 고르면 됩니다.",
      en: "Choose family for shared routines, personal for solo planning, and couple for shared plans and milestones.",
    },
  },
] as const;

export default function DashboardTemplatesLandingPage() {
  const { language, t } = useI18n();
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get("dashboardId");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(191,126,71,0.10),_transparent_35%),linear-gradient(180deg,_rgba(251,248,241,1)_0%,_rgba(246,240,229,1)_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-[32px] border border-border/80 bg-card/90 p-6 shadow-[0_20px_60px_rgba(72,52,32,0.08)] sm:p-8">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              {t("대시보드 템플릿", "Dashboard templates")}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {t(
                "템플릿 허브",
                "Template Hub"
              )}
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              {t(
                "가족용, 개인용, 커플용 예시를 살펴보고, 원하는 구성을 그대로 새 대시보드로 시작할 수 있어요.",
                "Browse family, personal, and couple examples, then start a new dashboard with the exact setup you want."
              )}
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/">
                  {t("홈으로 돌아가기", "Back to home")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {dashboardTemplates.map((template) => (
            <Link
              key={template.slug}
              href={
                dashboardId
                  ? `/templates/${template.slug}?dashboardId=${encodeURIComponent(
                      dashboardId
                    )}`
                  : `/templates/${template.slug}`
              }
              className="group rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-sm transition hover:border-primary/35 hover:bg-card"
            >
              <div className="text-sm font-medium text-primary">
                {getLocalizedText(template.eyebrow, language)}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {getLocalizedText(template.name, language)}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {getLocalizedText(template.summary, language)}
              </p>
              <div className="mt-4 rounded-2xl border border-border/80 bg-accent/55 p-4 text-sm leading-6 text-foreground/80">
                {getLocalizedText(template.audience, language)}
              </div>
              <div className="mt-4 space-y-2">
                {template.widgets.slice(0, 3).map((widget) => (
                  <div
                    key={`${template.slug}-${widget.type}`}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{getLocalizedText(widget.title, language)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                {t("템플릿 자세히 보기", "View details")}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>

        <section className="rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            {t("자주 묻는 질문", "Frequently asked questions")}
          </div>
          <div className="mt-4 grid gap-4">
            {faqs.map((faq) => (
              <div
                key={faq.key}
                className="rounded-2xl border border-border/80 bg-accent/55 p-4"
              >
                <div className="text-base font-semibold text-foreground">
                  {faq.question[language]}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {faq.answer[language]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
