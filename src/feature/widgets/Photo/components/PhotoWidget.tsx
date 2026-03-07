import Image from "next/image";
import type { ChangeEvent, KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Upload, X } from "lucide-react";
import { PhotoViewerDialog } from "@/feature/widgets/Photo/components/PhotoViewerDialog";
import { usePhotoViewer } from "@/feature/widgets/Photo/hooks/usePhotoViewer";
import { usePhotoWidget } from "@/feature/widgets/Photo/hooks/usePhotoWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { ActionMenuButton } from "@/shared/ui/buttons/DropdownButton";
import { Button } from "@/shared/ui/button";
import type { Id } from "@/shared/db/schema";
import { useI18n } from "@/shared/i18n/client";

type PhotoWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

const PHOTO_CLICK_DRAG_THRESHOLD_PX = 6;

export function PhotoWidget({ widgetId, canEdit = true }: PhotoWidgetProps) {
  const { t } = useI18n();
  const { photoUrl, hasPhoto, replacePhoto, clearPhoto } =
    usePhotoWidget(widgetId);
  const viewer = usePhotoViewer(photoUrl);
  const [isReplacingPhoto, setIsReplacingPhoto] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const openFileDialog = useCallback(() => {
    if (!canEdit) return;
    inputRef.current?.click();
  }, [canEdit]);

  useEffect(() => {
    if (!photoUrl) {
      setIsImageLoading(false);
      return;
    }
    const image = imageRef.current;
    setIsImageLoading(!(image?.complete && image.naturalWidth > 0));
  }, [photoUrl]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const input = event.currentTarget;
      setIsReplacingPhoto(true);
      try {
        await replacePhoto(file);
      } finally {
        setIsReplacingPhoto(false);
        input.value = "";
      }
    },
    [replacePhoto]
  );

  const uploadItem = {
    text: hasPhoto ? t("사진 변경", "Change photo") : t("사진 업로드", "Upload photo"),
    icon: <Upload className="size-4" />,
    disabled: isReplacingPhoto,
    onClick: openFileDialog,
  };

  const extraItems = hasPhoto
    ? [
        uploadItem,
        {
          text: t("사진 비우기", "Clear photo"),
          icon: <X className="size-4" />,
          disabled: isReplacingPhoto,
          onClick: () => void clearPhoto(),
        },
      ]
    : [uploadItem];

  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: t("위젯 삭제", "Delete widget"),
    extraItems,
  });

  const showActions = canEdit && actions.length > 0 && !isReplacingPhoto;
  const isPhotoBusy = isReplacingPhoto || (Boolean(photoUrl) && isImageLoading);

  const handlePhotoPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      pointerStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      suppressClickRef.current = false;
    },
    []
  );

  const handlePhotoPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current;
      if (!state || state.pointerId !== event.pointerId || state.moved) return;
      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      if (Math.hypot(deltaX, deltaY) >= PHOTO_CLICK_DRAG_THRESHOLD_PX) {
        state.moved = true;
      }
    },
    []
  );

  const handlePhotoPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      suppressClickRef.current = state.moved;
      pointerStateRef.current = null;
    },
    []
  );

  const handlePhotoPointerCancel = useCallback(() => {
    pointerStateRef.current = null;
    suppressClickRef.current = true;
  }, []);

  const handlePhotoClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    viewer.openViewer();
  }, [viewer]);

  const handlePhotoKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      viewer.openViewer();
    },
    [viewer]
  );

  return (
    <WidgetCard className="p-0">
      <div className="relative h-full w-full" aria-busy={isPhotoBusy}>
        {showActions ? (
          <div className="absolute right-2 top-2 z-10">
            <ActionMenuButton
              items={actions}
              triggerAriaLabel={t("사진 위젯 메뉴", "Photo widget menu")}
            />
          </div>
        ) : null}

        {photoUrl ? (
          <div
            className="relative flex h-full w-full cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
            role="button"
            tabIndex={0}
            onPointerDown={handlePhotoPointerDown}
            onPointerMove={handlePhotoPointerMove}
            onPointerUp={handlePhotoPointerUp}
            onPointerCancel={handlePhotoPointerCancel}
            onClick={handlePhotoClick}
            onKeyDown={handlePhotoKeyDown}
            aria-label={t("사진 전체 화면 보기", "Open photo in full screen")}
          >
            <Image
              ref={imageRef}
              src={photoUrl}
              alt={t("업로드된 사진", "Uploaded photo")}
              width={1}
              height={1}
              unoptimized
              className="pointer-events-none block h-full w-auto max-w-none shrink-0"
              draggable={false}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
            {isPhotoBusy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 px-4">
                <div
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>
                    {isReplacingPhoto
                      ? t("사진 저장 중...", "Saving photo...")
                      : t("사진 불러오는 중...", "Loading photo...")}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
            {isReplacingPhoto ? (
              <>
                <LoaderCircle className="size-6 animate-spin text-primary" />
                <div
                  role="status"
                  aria-live="polite"
                  className="text-sm font-medium text-gray-500"
                >
                  {t("사진 저장 중...", "Saving photo...")}
                </div>
              </>
            ) : (
              <>
                <Upload className="size-6" />
                <div className="text-sm font-medium text-gray-500">
                  {t("사진이 없습니다", "No photo")}
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFileDialog}
                    disabled={isReplacingPhoto}
                  >
                    {t("사진 업로드", "Upload photo")}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {photoUrl ? <PhotoViewerDialog photoUrl={photoUrl} viewer={viewer} /> : null}

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName={t("사진", "Photo")}
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
