"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import { useI18n } from "@/shared/i18n/client";

const INSTALLED_STORAGE_KEY = "lifedashboard.installPrompt.installed";
const DISMISSED_UNTIL_STORAGE_KEY = "lifedashboard.installPrompt.dismissedUntil";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

type BrowserKind = "safari" | "chrome" | "samsung" | "other";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type HomeScreenInstallPromptProps = {
  disabled?: boolean;
};

function detectBrowserKind(userAgent: string): BrowserKind {
  const ua = userAgent.toLowerCase();

  if (ua.includes("samsungbrowser")) return "samsung";
  if (ua.includes("crios")) return "chrome";

  const hasChrome = ua.includes("chrome") || ua.includes("chromium");
  const hasSafari = ua.includes("safari");
  const hasEdge = ua.includes("edg/");
  const hasFirefox = ua.includes("firefox") || ua.includes("fxios");
  const hasOpera = ua.includes("opr/");

  if (hasChrome && !hasEdge && !hasOpera) return "chrome";
  if (hasSafari && !hasChrome && !hasEdge && !hasFirefox) return "safari";

  return "other";
}

function isMobileOrTabletDevice(userAgent: string): boolean {
  return /android|iphone|ipad|ipod|tablet|mobile/i.test(userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function readStoredTimestamp(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function HomeScreenInstallPrompt({
  disabled = false,
}: HomeScreenInstallPromptProps) {
  const { t } = useI18n();
  const [isEligibleDevice, setIsEligibleDevice] = useState(false);
  const [browserKind, setBrowserKind] = useState<BrowserKind>("other");
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const markInstalled = useCallback(() => {
    setIsInstalled(true);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
    window.localStorage.removeItem(DISMISSED_UNTIL_STORAGE_KEY);
  }, []);

  const dismissPrompt = useCallback(() => {
    if (typeof window === "undefined") return;
    const nextDismissedUntil = Date.now() + DISMISS_COOLDOWN_MS;
    window.localStorage.setItem(
      DISMISSED_UNTIL_STORAGE_KEY,
      String(nextDismissedUntil)
    );
    setDismissedUntil(nextDismissedUntil);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPromptEvent || isInstalling) return;
    setIsInstalling(true);

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === "accepted") {
        markInstalled();
      } else {
        dismissPrompt();
      }
    } catch {
      dismissPrompt();
    } finally {
      setInstallPromptEvent(null);
      setIsInstalling(false);
    }
  }, [dismissPrompt, installPromptEvent, isInstalling, markInstalled]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const currentBrowserKind = detectBrowserKind(navigator.userAgent);
    setBrowserKind(currentBrowserKind);
    setIsEligibleDevice(isMobileOrTabletDevice(navigator.userAgent));

    const currentlyStandalone = isStandaloneMode();
    setIsStandalone(currentlyStandalone);
    if (currentlyStandalone) {
      window.localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
    }

    setIsInstalled(window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "1");
    setDismissedUntil(readStoredTimestamp(DISMISSED_UNTIL_STORAGE_KEY));

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches);
      if (event.matches) {
        window.localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
      }
    };

    const onAppInstalled = () => {
      markInstalled();
    };

    const onBeforeInstallPrompt = (event: Event) => {
      const typedEvent = event as BeforeInstallPromptEvent;
      typedEvent.preventDefault();
      setInstallPromptEvent(typedEvent);
    };

    displayModeQuery.addEventListener("change", onDisplayModeChange);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      displayModeQuery.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [markInstalled]);

  const guideMessage = useMemo(
    () =>
      ({
        safari: t(
          "Safari에서 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택해 주세요.",
          "In Safari, tap Share and choose 'Add to Home Screen'."
        ),
        chrome: t(
          "Chrome 메뉴(⋮)에서 '홈 화면에 추가' 또는 '앱 설치'를 선택해 주세요.",
          "In Chrome, open the menu (⋮) and choose 'Add to Home screen' or 'Install app'."
        ),
        samsung: t(
          "삼성 인터넷에서 주소창 설치 아이콘(+) 또는 메뉴의 '홈 화면에 추가'를 사용해 주세요.",
          "In Samsung Internet, use the address bar install icon (+) or 'Add page to' from the menu."
        ),
        other: t(
          "브라우저 메뉴에서 '홈 화면에 추가'를 선택해 주세요.",
          "Use your browser menu and choose 'Add to Home Screen'."
        ),
      })[browserKind],
    [browserKind, t]
  );

  const isDismissed = dismissedUntil > Date.now();
  const shouldShow =
    !disabled && isEligibleDevice && !isStandalone && !isInstalled && !isDismissed;

  if (!shouldShow) return null;

  return (
    <div className="mx-4 -mt-1 mb-2 rounded-md border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {t(
              "홈 화면에 추가하면 앱처럼 더 빠르게 열 수 있어요.",
              "Add this to your home screen for faster access."
            )}
          </div>
          <div className="text-[11px] text-amber-700/90 dark:text-amber-200/90">
            {guideMessage}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {installPromptEvent ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => void handleInstall()}
              disabled={isInstalling}
            >
              {isInstalling ? t("설치 중...", "Installing...") : t("설치", "Install")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-amber-300 bg-white/80 px-2 text-[11px] text-amber-800 hover:bg-white dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40"
            onClick={markInstalled}
          >
            {t("이미 추가했어요", "Already added")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-amber-300 bg-white/80 px-2 text-[11px] text-amber-800 hover:bg-white dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40"
            onClick={dismissPrompt}
          >
            {t("나중에", "Later")}
          </Button>
        </div>
      </div>
    </div>
  );
}
