"use client";

import { useEffect, useState } from "react";
import { Copy, LogIn, LogOut } from "lucide-react";
import Image from "next/image";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { deleteLocalDatabase } from "@/shared/db/db";
import {
  detectInAppBrowser,
} from "@/shared/lib/inAppBrowser";
import { useI18n } from "@/shared/i18n/client";
import { signIn, signOut } from "next-auth/react";
import type { Session } from "next-auth";

type AccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authUser: Session["user"] | null;
  isAuthLoading: boolean;
  isSignedIn: boolean;
  authDisplayName: string;
  authAvatarFallback: string;
};

export default function AccountDialog({
  open,
  onOpenChange,
  authUser,
  isAuthLoading,
  isSignedIn,
  authDisplayName,
  authAvatarFallback,
}: AccountDialogProps) {
  const { language, setLanguage, t } = useI18n();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const userAgent = navigator.userAgent;
    const inApp = detectInAppBrowser(userAgent);
    setIsInAppBrowser(inApp);
  }, []);

  const clearLocalData = async () => {
    await deleteLocalDatabase();
    const keysToRemove = Object.keys(localStorage).filter((key) =>
      key.startsWith("lifedashboard.")
    );
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  };

  const handleDeleteLocalData = async () => {
    if (isDeletingLocal) return;
    setIsDeletingLocal(true);
    try {
      await clearLocalData();
      window.location.reload();
    } finally {
      setIsDeletingLocal(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await clearLocalData();
    } catch {
      // Continue sign out even if local cleanup fails.
    }
    await signOut({ callbackUrl: "/" });
  };

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("계정", "Account")}</DialogTitle>
            <DialogDescription>
              {t(
                "Google 계정으로 로그인해서 서버에 데이터를 연결할 수 있어요.",
                "Sign in with Google to connect your data to the server."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {isAuthLoading ? (
              <div className="text-sm text-gray-500">
                {t("로그인 상태 확인 중...", "Checking sign-in status...")}
              </div>
            ) : isSignedIn ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 dark:border-gray-700/70 dark:bg-gray-900/20">
                {authUser?.image ? (
                  <Image
                    src={authUser.image}
                    alt={authDisplayName}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {authAvatarFallback}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {authDisplayName}
                  </div>
                  {authUser?.email ? (
                    <div className="truncate text-xs text-gray-500">
                      {authUser.email}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="text-sm text-gray-500">
                  {t(
                    "로그인하면 여러 기기에서 데이터를 이어서 사용할 수 있어요.",
                    "Sign in to continue your data across devices."
                  )}
                </div>
                {isInAppBrowser ? (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
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
                        onClick={() => void handleCopyCurrentLink()}
                      >
                        <Copy className="size-4" />
                        {t("링크 복사", "Copy link")}
                      </Button>
                    </div>
                    {copyStatus === "success" ? (
                      <div className="mt-1">
                        {t(
                          "링크를 복사했어요. 사용하시는 브라우저로 열어주세요.",
                          "Link copied. Open it in your browser."
                        )}
                      </div>
                    ) : null}
                    {copyStatus === "error" ? (
                      <div className="mt-1">
                        {t(
                          "자동 복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.",
                          "Automatic copy failed. Please copy the URL from the address bar."
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200/80 bg-white/50 px-2.5 py-1.5 dark:border-gray-700/70 dark:bg-gray-900/20">
            <div className="text-[10px] font-medium text-gray-400">
              {t("언어", "Language")}
            </div>
            <div className="inline-flex rounded-sm border border-gray-200/80 bg-gray-100/70 p-0.5 text-[11px] leading-none dark:border-gray-600/70 dark:bg-gray-700/30">
              <button
                type="button"
                onClick={() => setLanguage("ko")}
                className={[
                  "rounded-sm px-2 py-1 transition-colors",
                  language === "ko"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-100/10 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white",
                ].join(" ")}
              >
                한국어
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={[
                  "rounded-sm px-2 py-1 transition-colors",
                  language === "en"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-100/10 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white",
                ].join(" ")}
              >
                English
              </button>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isSignedIn ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSigningOut}
                >
                  {t("로컬 데이터 삭제", "Clear local data")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  disabled={isSigningOut || isDeletingLocal}
                >
                  <LogOut className="size-4" />
                  {isSigningOut
                    ? t("로그아웃 중...", "Signing out...")
                    : t("로그아웃", "Sign out")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSigningOut}
                >
                  {t("로컬 데이터 삭제", "Clear local data")}
                </Button>
                {isInAppBrowser ? null : (
                  <Button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    disabled={isAuthLoading}
                  >
                    <LogIn className="size-4" />
                    {t("Google로 로그인", "Sign in with Google")}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(
                "로컬 데이터를 삭제할까요?",
                "Clear local data?"
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "로컬에 저장된 위젯, 기록, 동기화 대기 변경이 모두 삭제됩니다.",
                "All locally stored widgets, records, and pending sync changes will be deleted."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeletingLocal || isSigningOut}
            >
              {t("취소", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteLocalData}
              disabled={isDeletingLocal || isSigningOut}
            >
              {isDeletingLocal ? t("삭제 중...", "Deleting...") : t("삭제", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
