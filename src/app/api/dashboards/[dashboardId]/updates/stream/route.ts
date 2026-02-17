import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";
import { requireUser } from "@/server/api-auth";
import { subscribeDashboardUpdate } from "@/server/dashboard-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessDashboard = {
  id: string;
  ownerId: string | null;
  groupId: string | null;
  updatedAt: Date;
};

async function ensureAccess(dashboardId: string, userId: string): Promise<AccessDashboard | null> {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, ownerId: true, groupId: true, updatedAt: true },
  });
  if (!dashboard) return null;

  if (dashboard.groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: dashboard.groupId, userId },
      select: { id: true },
    });
    if (!member) return null;
  } else if (dashboard.ownerId && dashboard.ownerId !== userId) {
    return null;
  }

  return dashboard;
}

function encodeSseChunk(params: {
  event?: string;
  id?: string;
  data?: unknown;
  comment?: string;
}) {
  if (params.comment) {
    return `: ${params.comment}\n\n`;
  }

  let chunk = "";
  if (params.id) chunk += `id: ${params.id}\n`;
  if (params.event) chunk += `event: ${params.event}\n`;

  const payload =
    typeof params.data === "string" ? params.data : JSON.stringify(params.data ?? {});
  for (const line of payload.split("\n")) {
    chunk += `data: ${line}\n`;
  }
  chunk += "\n";
  return chunk;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult.response;
  const userId = userResult.context.userId;

  const { dashboardId } = await params;
  const dashboard = await ensureAccess(dashboardId, userId);
  if (!dashboard) return jsonError(404, "Dashboard not found");

  const encoder = new TextEncoder();

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let accessCheckTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe = () => {};
  let abortHandler: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let onAbort = () => {};

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (accessCheckTimer) clearInterval(accessCheckTimer);
        unsubscribe();
        if (abortHandler) {
          request.signal.removeEventListener("abort", abortHandler);
          abortHandler = null;
        }
        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      const send = (event: string, data: unknown, id?: string) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            encodeSseChunk({
              event,
              id,
              data,
            })
          )
        );
      };

      onAbort = () => {
        close();
      };
      abortHandler = onAbort;

      request.signal.addEventListener("abort", onAbort);

      send("ready", { updatedAt: dashboard.updatedAt.toISOString() });

      unsubscribe = subscribeDashboardUpdate(dashboardId, (message) => {
        send(
          "dashboard-updated",
          {
            updatedAt: message.updatedAt,
            ...(message.clientId ? { clientId: message.clientId } : {}),
          },
          message.updatedAt
        );
      });

      heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSseChunk({ comment: "keep-alive" })));
      }, 25000);

      let accessCheckInFlight = false;
      accessCheckTimer = setInterval(() => {
        if (closed || accessCheckInFlight) return;
        accessCheckInFlight = true;

        void (async () => {
          try {
            const latest = await ensureAccess(dashboardId, userId);
            if (!latest) {
              send("forbidden", { reason: "access-revoked" });
              close();
            }
          } finally {
            accessCheckInFlight = false;
          }
        })();
      }, 30000);
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (accessCheckTimer) clearInterval(accessCheckTimer);
      unsubscribe();
      if (abortHandler) {
        request.signal.removeEventListener("abort", abortHandler);
        abortHandler = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
