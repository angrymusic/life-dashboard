"use client";

import Link from "next/link";
import { Home, RefreshCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useI18n } from "@/shared/i18n/client";
import { localizeErrorMessage } from "@/shared/i18n/errorMessage";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const { t } = useI18n();
  const message = error.message.trim()
    ? localizeErrorMessage(error.message, t)
    : t(
        "잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침하거나 홈으로 돌아가세요.",
        "Please try again in a moment. If the problem continues, refresh or go back home."
      );

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_14%,transparent),transparent_50%),radial-gradient(circle_at_bottom_right,_color-mix(in_oklab,var(--accent)_85%,transparent),transparent_42%)]" />
      <section className="relative z-10 w-full max-w-xl rounded-3xl border border-border/80 bg-card/95 p-8 shadow-sm backdrop-blur">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {t("문제가 발생했어요", "Something went wrong")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          {t("페이지를 불러오지 못했어요.", "We couldn't load this page.")}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {t("오류 코드", "Error code")}: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" onClick={reset}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            {t("다시 시도", "Try again")}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">
              <Home className="size-4" aria-hidden="true" />
              {t("홈으로 이동", "Go home")}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
