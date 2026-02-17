import type { LocalPhoto, Photo } from "./schema";
import { db } from "./core";

async function uploadPhotoFile(
  file: Blob,
  mimeType: string,
  context: { dashboardId: string; widgetId: string }
) {
  const uploadFile =
    file instanceof File
      ? file
      : new File([file], `photo-${crypto.randomUUID()}`, { type: mimeType });
  const form = new FormData();
  form.append("file", uploadFile);
  form.append("dashboardId", context.dashboardId);
  form.append("widgetId", context.widgetId);

  const response = await fetch("/api/migrate/upload-photo", {
    method: "POST",
    body: form,
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    storagePath?: string;
    mimeType?: string;
  };
  if (!response.ok || !payload.ok || !payload.storagePath) {
    throw new Error("Photo upload failed");
  }
  return { storagePath: payload.storagePath, mimeType: payload.mimeType };
}

export function toPhotoRecord(localPhoto: LocalPhoto, storagePath: string): Photo {
  return {
    id: localPhoto.id,
    widgetId: localPhoto.widgetId,
    dashboardId: localPhoto.dashboardId,
    storagePath,
    mimeType: localPhoto.mimeType,
    caption: localPhoto.caption,
    takenAt: localPhoto.takenAt,
    createdAt: localPhoto.createdAt,
    updatedAt: localPhoto.updatedAt,
  };
}

export async function ensureServerStoragePath(localPhoto: LocalPhoto) {
  if (localPhoto.serverStoragePath) {
    return localPhoto.serverStoragePath;
  }
  if (!localPhoto.blob) {
    throw new Error("Missing local photo blob");
  }
  const { storagePath } = await uploadPhotoFile(
    localPhoto.blob,
    localPhoto.mimeType,
    {
      dashboardId: localPhoto.dashboardId,
      widgetId: localPhoto.widgetId,
    }
  );
  await db.localPhotos.update(localPhoto.id, {
    serverStoragePath: storagePath,
  });
  return storagePath;
}
