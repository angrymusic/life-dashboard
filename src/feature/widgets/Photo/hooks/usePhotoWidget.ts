import { useCallback, useEffect, useMemo } from "react";
import { db, newId, nowIso } from "@/shared/db/db";
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
    if (!photo?.blob) return null;
    return URL.createObjectURL(photo.blob);
  }, [photo]);

  useEffect(() => {
    if (!photoUrl) return;
    return () => {
      URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const replacePhoto = useCallback(
    async (file: File) => {
      if (!widget) return;
      if (file.type && !file.type.startsWith("image/")) return;

      const now = nowIso();
      const takenAt =
        file.lastModified > 0
          ? new Date(file.lastModified).toISOString()
          : now;

      await db.transaction("rw", db.localPhotos, async () => {
        await db.localPhotos.where("widgetId").equals(widgetId).delete();
        await db.localPhotos.add({
          id: newId(),
          widgetId,
          dashboardId: widget.dashboardId,
          blob: file,
          mimeType: file.type || "application/octet-stream",
          caption: undefined,
          takenAt,
          createdAt: now,
          updatedAt: now,
        });
      });
    },
    [widget, widgetId]
  );

  const clearPhoto = useCallback(async () => {
    await db.localPhotos.where("widgetId").equals(widgetId).delete();
  }, [widgetId]);

  return {
    photo,
    photoUrl,
    hasPhoto: Boolean(photo),
    replacePhoto,
    clearPhoto,
  };
}
