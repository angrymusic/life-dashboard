import { NextResponse } from "next/server";
import { jsonError } from "@/server/api-response";
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const relPath = searchParams.get("path");
  if (!relPath) {
    return jsonError(400, "Missing path");
  }

  const baseDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
  const normalized = path.posix.normalize(relPath).replace(/^\.+/, "");
  const safePath = normalized.replace(/^\/+/, "");
  const absPath = path.join(baseDir, safePath);

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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return jsonError(404, "File not found");
  }
}
