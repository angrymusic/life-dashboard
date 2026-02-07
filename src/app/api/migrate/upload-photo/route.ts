// app/api/migrate/upload-photo/route.ts
import { NextResponse } from "next/server";
import { jsonError } from "@/server/api-response";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function safeJoinPosix(...parts: string[]) {
  // storagePath를 항상 "/"로 통일
  return parts.join("/").replaceAll("\\", "/");
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError(400, "Content-Type must be multipart/form-data");
  }

  const form = await request.formData();

  const fileValue: FormDataEntryValue | null = form.get("file");
  if (!fileValue) {
    return jsonError(400, 'Missing form field "file"');
  }
  if (!(fileValue instanceof File)) {
    return jsonError(400, '"file" must be a File');
  }

  const file = fileValue;

  const mimeType = file.type || "application/octet-stream";
  if (!mimeType.startsWith("image/")) {
    return jsonError(400, "Only image/* is allowed", { mimeType });
  }

  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024); // 기본 10MB
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return jsonError(500, "Invalid UPLOAD_MAX_BYTES env");
  }
  if (file.size > maxBytes) {
    return jsonError(413, "File too large", { size: file.size, maxBytes });
  }

  // 저장 경로: {UPLOAD_DIR}/photos/YYYY/MM/<uuid>.<ext>
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  const baseDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
  const relDir = path.join("photos", yyyy, mm); // OS path
  const absDir = path.join(baseDir, relDir);

  await ensureDir(absDir);

  const uuid = crypto.randomUUID();
  const ext = extFromMime(mimeType);
  const filename = `${uuid}.${ext}`;

  const absPath = path.join(absDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  // 앱/DB에 저장할 경로는 "업로드 루트 기준 상대 경로"가 깔끔함
  // 예: photos/2026/01/uuid.jpg
  const storagePath = safeJoinPosix("photos", yyyy, mm, filename);

  return NextResponse.json({
    ok: true,
    storagePath,
    mimeType,
    size: file.size,
  });
}
