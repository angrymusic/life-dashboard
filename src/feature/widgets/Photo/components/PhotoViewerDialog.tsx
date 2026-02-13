import Image from "next/image";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import type { PhotoViewerController } from "@/feature/widgets/Photo/hooks/usePhotoViewer";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { useI18n } from "@/shared/i18n/client";
import { cn } from "@/shared/lib/utils";

type PhotoViewerDialogProps = {
  photoUrl: string;
  viewer: PhotoViewerController;
};

export function PhotoViewerDialog({ photoUrl, viewer }: PhotoViewerDialogProps) {
  const { t } = useI18n();
  const {
    viewerViewportRef,
    isViewerOpen,
    zoomPercent,
    offset,
    isDragging,
    isZoomed,
    canZoomIn,
    canZoomOut,
    handleViewerOpenChange,
    zoomIn,
    zoomOut,
    resetViewer,
    handleViewerPointerDown,
    handleViewerPointerMove,
    handleViewerPointerEnd,
    handleImageLoad,
    zoom,
  } = viewer;

  return (
    <Dialog open={isViewerOpen} onOpenChange={handleViewerOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[100svh] w-[100vw] max-h-[100svh] max-w-[100vw] overflow-hidden rounded-none border-0 bg-black/95 p-0 shadow-none sm:max-w-[100vw] sm:p-0"
      >
        <DialogTitle className="sr-only">
          {t("사진 전체 화면 보기", "Photo full screen viewer")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t(
            "원본 사진을 전체 화면에서 확대/축소하고 이동할 수 있습니다.",
            "You can zoom and pan the original photo in full screen."
          )}
        </DialogDescription>
        <div className="relative h-full w-full">
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md bg-black/60 p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={zoomOut}
                disabled={!canZoomOut}
                aria-label={t("축소", "Zoom out")}
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-12 text-center text-xs font-medium text-white">
                {zoomPercent}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={zoomIn}
                disabled={!canZoomIn}
                aria-label={t("확대", "Zoom in")}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={resetViewer}
                aria-label={t("확대 초기화", "Reset zoom")}
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="bg-black/60 text-white hover:bg-white/20 hover:text-white"
              onClick={() => handleViewerOpenChange(false)}
              aria-label={t("닫기", "Close")}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div
            ref={viewerViewportRef}
            className={cn(
              "relative h-full w-full overflow-hidden",
              isZoomed ? "touch-none cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            onPointerDown={handleViewerPointerDown}
            onPointerMove={handleViewerPointerMove}
            onPointerUp={handleViewerPointerEnd}
            onPointerCancel={handleViewerPointerEnd}
          >
            <Image
              src={photoUrl}
              alt={t("업로드된 사진 원본", "Uploaded photo original")}
              width={1}
              height={1}
              unoptimized
              draggable={false}
              onLoad={(event) => {
                handleImageLoad(
                  event.currentTarget.naturalWidth,
                  event.currentTarget.naturalHeight
                );
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 h-auto max-h-full w-auto max-w-full select-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md bg-black/55 px-3 py-1 text-xs text-white/85">
            {t(
              "휠로 확대/축소하고, 확대 상태에서 드래그로 이동하세요.",
              "Use wheel to zoom, then drag to move while zoomed."
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
