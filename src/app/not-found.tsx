"use client";

import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/shared/i18n/client";
import { Button } from "@/shared/ui/button";

export default function NotFoundPage() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_color-mix(in_oklab,var(--primary)_14%,transparent),transparent_42%),radial-gradient(circle_at_bottom_right,_color-mix(in_oklab,var(--accent)_92%,transparent),transparent_40%)]" />
      <section className="relative z-10 w-full max-w-xl rounded-3xl border border-border/80 bg-card/95 p-8 shadow-sm backdrop-blur">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <SearchX className="size-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          {t("페이지를 찾을 수 없어요.", "Page not found.")}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {pathname && pathname !== "/"
            ? t(
                `요청한 경로 ${pathname} 는 존재하지 않거나 이동되었어요.`,
                `The requested path ${pathname} does not exist or has moved.`
              )
            : t(
                "요청한 페이지가 존재하지 않거나 이동되었어요.",
                "The page you requested does not exist or has moved."
              )}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
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
