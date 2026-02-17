import fs from "fs/promises";
import path from "path";
import prisma from "@/server/prisma";
import { isValidPhotoStoragePathForDashboard, normalizeStoragePath } from "@/server/photo-path";

type PhotoFileCleanupCandidate = {
  dashboardId: string;
  storagePath: string;
};

function resolvePhotoFileAbsolutePath(storagePath: string) {
  const normalized = normalizeStoragePath(storagePath);
  if (!normalized) return null;

  const baseDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
  const absPath = path.join(baseDir, normalized);

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(absPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    return null;
  }

  return resolvedTarget;
}

export async function removePhotoFilesIfUnreferenced(
  candidates: PhotoFileCleanupCandidate[]
) {
  if (candidates.length === 0) return;

  const deduped = new Map<string, PhotoFileCleanupCandidate>();
  for (const candidate of candidates) {
    if (
      !isValidPhotoStoragePathForDashboard(candidate.storagePath, candidate.dashboardId, {
        allowLegacy: true,
      })
    ) {
      continue;
    }
    if (!deduped.has(candidate.storagePath)) {
      deduped.set(candidate.storagePath, candidate);
    }
  }

  if (deduped.size === 0) return;

  await Promise.all(
    Array.from(deduped.values()).map(async (candidate) => {
      const refCount = await prisma.photo.count({
        where: { storagePath: candidate.storagePath },
      });
      if (refCount > 0) return;

      const absolutePath = resolvePhotoFileAbsolutePath(candidate.storagePath);
      if (!absolutePath) return;

      try {
        await fs.unlink(absolutePath);
      } catch (err) {
        if (
          !(err instanceof Error) ||
          !("code" in err) ||
          (err as NodeJS.ErrnoException).code !== "ENOENT"
        ) {
          // Ignore cleanup failures to avoid breaking API writes.
        }
      }
    })
  );
}
