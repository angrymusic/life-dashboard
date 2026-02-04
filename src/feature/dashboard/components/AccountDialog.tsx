"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
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

  const handleDeleteLocalData = async () => {
    if (isDeletingLocal) return;
    setIsDeletingLocal(true);
    try {
      await deleteLocalDatabase();
      window.location.reload();
    } finally {
      setIsDeletingLocal(false);
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
              <div className="text-sm text-gray-500">
                로그인하면 여러 기기에서 데이터를 이어서 사용할 수 있어요.
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
                >
                  로컬 데이터 삭제
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="size-4" />
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  로컬 데이터 삭제
                </Button>
                <Button
                  type="button"
                  onClick={() => signIn("google")}
                  disabled={isAuthLoading}
                >
                  <LogIn className="size-4" />
                  Google로 로그인
                </Button>
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
              disabled={isDeletingLocal}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteLocalData}
              disabled={isDeletingLocal}
            >
              {isDeletingLocal ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
