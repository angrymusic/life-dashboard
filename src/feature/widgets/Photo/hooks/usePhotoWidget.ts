import { useCallback, useEffect, useMemo } from "react";
import { clearLocalPhotos, nowIso, replaceLocalPhoto } from "@/shared/db/db";
import { useLocalPhotos, useWidget } from "@/shared/db/queries";
import type { Id, LocalPhoto } from "@/shared/db/schema";

const getPhotoTime = (photo: LocalPhoto) => {
  const value = photo.takenAt ?? photo.updatedAt ?? photo.createdAt;
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

export function usePhotoWidget(widgetId: Id) {
  const widget = useWidget(widgetId);
  const photos = useLocalPhotos(widgetId);

  const photo = useMemo(() => {
    const list = photos ?? [];
    if (!list.length) return null;
    return list.reduce((latest, item) => {
      return getPhotoTime(item) >= getPhotoTime(latest) ? item : latest;
    }, list[0]);
  }, [photos]);

  const photoUrl = useMemo(() => {
    if (!photo) return null;
    if (photo.blob) return URL.createObjectURL(photo.blob);
    if (photo.serverStoragePath) {
      return `/api/photos?id=${encodeURIComponent(photo.id)}`;
    }
    return null;
  }, [photo]);

  useEffect(() => {
    if (!photoUrl || !photo?.blob) return;
    return () => {
      URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl, photo?.blob]);

  const replacePhoto = useCallback(
    async (file: File) => {
      if (!widget) return;
      if (file.type && !file.type.startsWith("image/")) return;

      const takenAt =
        file.lastModified > 0
          ? new Date(file.lastModified).toISOString()
          : nowIso();

      await replaceLocalPhoto({
        widgetId,
        dashboardId: widget.dashboardId,
        file,
        takenAt,
      });
    },
    [widget, widgetId]
  );

  const clearPhoto = useCallback(async () => {
    await clearLocalPhotos(widgetId);
  }, [widgetId]);

  return {
    photo,
    photoUrl,
    hasPhoto: Boolean(photo),
    replacePhoto,
    clearPhoto,
  };
}
