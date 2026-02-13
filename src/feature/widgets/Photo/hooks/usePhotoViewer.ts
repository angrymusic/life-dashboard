import type {
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Offset = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBaseImageSize(naturalSize: Size, viewportSize: Size) {
  if (
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const fitRatio = Math.min(
    1,
    viewportSize.width / naturalSize.width,
    viewportSize.height / naturalSize.height
  );

  return {
    width: naturalSize.width * fitRatio,
    height: naturalSize.height * fitRatio,
  };
}

function clampOffsetWithSizes(
  nextOffset: Offset,
  zoomValue: number,
  naturalSize: Size,
  viewportSize: Size
) {
  if (zoomValue <= MIN_ZOOM) return { x: 0, y: 0 };
  const baseSize = getBaseImageSize(naturalSize, viewportSize);
  if (baseSize.width <= 0 || baseSize.height <= 0) {
    return { x: 0, y: 0 };
  }

  const maxX = Math.max(0, (baseSize.width * zoomValue - viewportSize.width) / 2);
  const maxY = Math.max(
    0,
    (baseSize.height * zoomValue - viewportSize.height) / 2
  );

  return {
    x: clampValue(nextOffset.x, -maxX, maxX),
    y: clampValue(nextOffset.y, -maxY, maxY),
  };
}

export function usePhotoViewer(photoUrl: string | null) {
  const viewerViewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: Offset;
  } | null>(null);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [naturalSize, setNaturalSize] = useState<Size>({
    width: 0,
    height: 0,
  });
  const [viewportSize, setViewportSize] = useState<Size>({
    width: 0,
    height: 0,
  });

  const clampOffset = useCallback(
    (nextOffset: Offset, zoomValue: number) =>
      clampOffsetWithSizes(nextOffset, zoomValue, naturalSize, viewportSize),
    [naturalSize, viewportSize]
  );

  const resetViewer = useCallback(() => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    dragStateRef.current = null;
  }, []);

  const setZoomSafely = useCallback(
    (nextZoom: number | ((currentZoom: number) => number)) => {
      setZoom((currentZoom) => {
        const rawZoom =
          typeof nextZoom === "function" ? nextZoom(currentZoom) : nextZoom;
        const clampedZoom = clampValue(rawZoom, MIN_ZOOM, MAX_ZOOM);
        setOffset((prevOffset) => clampOffset(prevOffset, clampedZoom));
        return clampedZoom;
      });
    },
    [clampOffset]
  );

  const openViewer = useCallback(() => {
    if (!photoUrl) return;
    resetViewer();
    setNaturalSize({ width: 0, height: 0 });
    setIsViewerOpen(true);
  }, [photoUrl, resetViewer]);

  const handleViewerOpenChange = useCallback(
    (open: boolean) => {
      setIsViewerOpen(open);
      if (!open) {
        resetViewer();
        setNaturalSize({ width: 0, height: 0 });
        setViewportSize({ width: 0, height: 0 });
      }
    },
    [resetViewer]
  );

  const zoomIn = useCallback(() => {
    setZoomSafely((currentZoom) => currentZoom + ZOOM_STEP);
  }, [setZoomSafely]);

  const zoomOut = useCallback(() => {
    setZoomSafely((currentZoom) => currentZoom - ZOOM_STEP);
  }, [setZoomSafely]);

  const handleViewerWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setZoomSafely((currentZoom) => currentZoom + direction * ZOOM_STEP);
    },
    [setZoomSafely]
  );

  const handleViewerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (zoom <= MIN_ZOOM) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offset,
      };
      setIsDragging(true);
    },
    [offset, zoom]
  );

  const handleViewerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      event.preventDefault();
      const nextOffset = {
        x: dragState.startOffset.x + (event.clientX - dragState.startX),
        y: dragState.startOffset.y + (event.clientY - dragState.startY),
      };
      setOffset(clampOffset(nextOffset, zoom));
    },
    [clampOffset, zoom]
  );

  const handleViewerPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragStateRef.current = null;
      setIsDragging(false);
    },
    []
  );

  const handleImageLoad = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const nextNaturalSize = {
        width: naturalWidth,
        height: naturalHeight,
      };
      setNaturalSize(nextNaturalSize);
      setOffset((prevOffset) =>
        clampOffsetWithSizes(prevOffset, zoom, nextNaturalSize, viewportSize)
      );
    },
    [viewportSize, zoom]
  );

  useEffect(() => {
    if (!isViewerOpen) return;

    const viewport = viewerViewportRef.current;
    if (!viewport) return;

    const syncViewportSize = () => {
      const nextViewportSize = {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      };
      setViewportSize(nextViewportSize);
      setOffset((prevOffset) =>
        clampOffsetWithSizes(prevOffset, zoom, naturalSize, nextViewportSize)
      );
    };

    syncViewportSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncViewportSize);
      return () => {
        window.removeEventListener("resize", syncViewportSize);
      };
    }

    const observer = new ResizeObserver(syncViewportSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isViewerOpen, naturalSize, zoom]);

  useEffect(() => {
    if (!isViewerOpen) return;

    const viewport = viewerViewportRef.current;
    if (!viewport) return;

    viewport.addEventListener("wheel", handleViewerWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleViewerWheel);
    };
  }, [handleViewerWheel, isViewerOpen]);

  return {
    viewerViewportRef,
    isViewerOpen,
    zoom,
    zoomPercent: Math.round(zoom * 100),
    offset,
    isDragging,
    isZoomed: zoom > MIN_ZOOM,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    openViewer,
    handleViewerOpenChange,
    zoomIn,
    zoomOut,
    resetViewer,
    handleViewerPointerDown,
    handleViewerPointerMove,
    handleViewerPointerEnd,
    handleImageLoad,
  };
}

export type PhotoViewerController = ReturnType<typeof usePhotoViewer>;
