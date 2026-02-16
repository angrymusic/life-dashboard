// app/api/migrate/upload-photo/route.ts
import { NextResponse } from "next/server";
import { jsonError } from "@/server/api-response";
import { isAdminRole, requireUser } from "@/server/api-auth";
import prisma from "@/server/prisma";
import {
  contentLengthExceeds,
  enforceRateLimit,
  parsePositiveIntEnv,
} from "@/server/request-guards";
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

function readTextField(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function ensureDashboardUploadAccess(params: {
  dashboardId: string;
  widgetId: string;
  userId: string;
}) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: params.dashboardId },
    select: { id: true, ownerId: true, groupId: true },
  });
  if (!dashboard) {
    throw new Error("Dashboard not found");
  }

  let role: string | null = null;
  if (dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: dashboard.groupId, userId: params.userId },
      select: { role: true },
    });
    if (!member) {
      throw new Error("Forbidden");
    }
    role = member.role;
  } else if (!dashboard.ownerId || dashboard.ownerId !== params.userId) {
    throw new Error("Forbidden");
  }

  const widget = await prisma.widget.findUnique({
    where: { id: params.widgetId },
    select: { dashboardId: true, createdBy: true },
  });
  if (!widget) {
    return;
  }

  if (widget.dashboardId !== params.dashboardId) {
    throw new Error("Widget dashboard mismatch");
  }

  if (dashboard.groupId && !isAdminRole(role)) {
    if (widget.createdBy !== params.userId) {
      throw new Error("Forbidden");
    }
  }
}

export async function POST(request: Request) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const { userId } = userResult.context;

  const rateLimit = await enforceRateLimit({
    key: `photo-upload:${userId}`,
    limit: parsePositiveIntEnv(process.env.PHOTO_UPLOAD_RATE_LIMIT, 30),
    windowMs: parsePositiveIntEnv(
      process.env.PHOTO_UPLOAD_RATE_WINDOW_MS,
      60 * 1000
    ),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const maxBytes = parsePositiveIntEnv(
    process.env.UPLOAD_MAX_BYTES,
    10 * 1024 * 1024
  );
  const maxMultipartBytes = maxBytes + 64 * 1024;
  if (contentLengthExceeds(request, maxMultipartBytes)) {
    return jsonError(413, "File too large", {
      maxBytes,
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError(400, "Content-Type must be multipart/form-data");
  }

  const form = await request.formData();
  const dashboardId = readTextField(form, "dashboardId");
  const widgetId = readTextField(form, "widgetId");
  if (!dashboardId || !widgetId) {
    return jsonError(400, 'Missing form field "dashboardId" or "widgetId"');
  }

  try {
    await ensureDashboardUploadAccess({ dashboardId, widgetId, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forbidden";
    if (message === "Dashboard not found") {
      return jsonError(404, message);
    }
    if (message === "Widget dashboard mismatch") {
      return jsonError(400, message);
    }
    return jsonError(403, "Forbidden");
  }

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
