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
      // 로그아웃은 항상 진행한다.
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
            <DialogTitle>계정</DialogTitle>
            <DialogDescription>
              Google 계정으로 로그인해서 서버에 데이터를 연결할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {isAuthLoading ? (
              <div className="text-sm text-gray-500">로그인 상태 확인 중...</div>
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
                  로그인하면 여러 기기에서 데이터를 이어서 사용할 수 있어요.
                </div>
                {isInAppBrowser ? (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
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
                        <Copy className="size-4" />
                        링크 복사
                      </Button>
                    </div>
                    {copyStatus === "success" ? (
                      <div className="mt-1">
                         링크를 복사했어요. 사용하시는 브라우저로 열어주세요.
                      </div>
                    ) : null}
                    {copyStatus === "error" ? (
                      <div className="mt-1">
                        자동 복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
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
                  로컬 데이터 삭제
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  disabled={isSigningOut || isDeletingLocal}
                >
                  <LogOut className="size-4" />
                  {isSigningOut ? "로그아웃 중..." : "로그아웃"}
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
                  로컬 데이터 삭제
                </Button>
                {isInAppBrowser ? null : (
                  <Button
                    type="button"
                    onClick={() => signIn("google")}
                    disabled={isAuthLoading}
                  >
                    <LogIn className="size-4" />
                    Google로 로그인
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
            <DialogTitle>로컬 데이터를 삭제할까요?</DialogTitle>
            <DialogDescription>
              로컬에 저장된 위젯, 기록, 동기화 대기 변경이 모두 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeletingLocal || isSigningOut}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteLocalData}
              disabled={isDeletingLocal || isSigningOut}
            >
              {isDeletingLocal ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
