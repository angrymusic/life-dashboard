import { NextResponse } from "next/server";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import prisma from "@/server/prisma";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFromExt(ext: string) {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

function normalizeStoragePath(value: string) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  const trimmed = normalized.replace(/^\/+/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("..")) return null;
  return trimmed;
}

export async function GET(request: Request) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");
  if (!rawPath) {
    return jsonError(400, "Missing path");
  }
  const storagePath = normalizeStoragePath(rawPath);
  if (!storagePath) {
    return jsonError(400, "Invalid path");
  }

  const photo = await prisma.photo.findFirst({
    where: { storagePath },
    select: {
      storagePath: true,
      dashboard: {
        select: {
          id: true,
          ownerId: true,
          groupId: true,
        },
      },
    },
  });
  if (!photo?.dashboard) {
    return jsonError(404, "File not found");
  }

  if (photo.dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: photo.dashboard.groupId,
        userId,
      },
      select: { id: true },
    });
    if (!member) {
      return jsonError(404, "File not found");
    }
  } else if (photo.dashboard.ownerId && photo.dashboard.ownerId !== userId) {
    return jsonError(404, "File not found");
  }

  const baseDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
  const absPath = path.join(baseDir, photo.storagePath);

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(absPath);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    return jsonError(400, "Invalid path");
  }

  try {
    const buffer = await fs.readFile(resolvedTarget);
    const ext = path.extname(resolvedTarget);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFromExt(ext),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return jsonError(404, "File not found");
  }
}
