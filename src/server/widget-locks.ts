import prisma from "@/server/prisma";
import { parsePositiveIntEnv } from "@/server/request-guards";
import { Prisma } from "@prisma/client";

type WidgetLockRow = {
  widgetId: string;
  dashboardId: string;
  userId: string;
  displayName: string;
  expiresAt: Date;
};

export type WidgetLockView = {
  widgetId: string;
  userId: string;
  displayName: string;
  expiresAt: string;
  isMine: boolean;
};

export type AcquireWidgetLockParams = {
  widgetId: string;
  dashboardId: string;
  userId: string;
  displayName: string;
  force?: boolean;
  canForce?: boolean;
};

export type ReleaseWidgetLockParams = {
  widgetId: string;
  userId: string;
  force?: boolean;
  canForce?: boolean;
};

const DEFAULT_WIDGET_LOCK_TTL_MS = 60_000;

export function getWidgetLockTtlMs() {
  return parsePositiveIntEnv(
    process.env.WIDGET_LOCK_TTL_MS,
    DEFAULT_WIDGET_LOCK_TTL_MS
  );
}

function isActiveLock(lock: WidgetLockRow, now: Date) {
  return lock.expiresAt.getTime() > now.getTime();
}

function toView(lock: WidgetLockRow, currentUserId: string): WidgetLockView {
  return {
    widgetId: lock.widgetId,
    userId: lock.userId,
    displayName: lock.displayName,
    expiresAt: lock.expiresAt.toISOString(),
    isMine: lock.userId === currentUserId,
  };
}

export class WidgetLockConflictError extends Error {
  readonly lock: WidgetLockRow;

  constructor(lock: WidgetLockRow) {
    super(`Widget is locked by ${lock.displayName}`);
    this.name = "WidgetLockConflictError";
    this.lock = lock;
  }
}

export class WidgetLockUnavailableError extends Error {
  constructor() {
    super("Widget lock storage is unavailable");
    this.name = "WidgetLockUnavailableError";
  }
}

function isWidgetLockTableMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;

  const table =
    typeof error.meta?.table === "string"
      ? error.meta.table.toLowerCase()
      : undefined;
  if (!table) return true;
  return table.includes("widgetlock");
}

function isWidgetLockUniqueConstraintError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2002";
}

export async function listActiveWidgetLocks(
  dashboardId: string,
  currentUserId: string
) {
  const now = new Date();
  try {
    await prisma.widgetLock.deleteMany({
      where: {
        dashboardId,
        expiresAt: {
          lte: now,
        },
      },
    });

    const locks = await prisma.widgetLock.findMany({
      where: {
        dashboardId,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        widgetId: true,
        dashboardId: true,
        userId: true,
        displayName: true,
        expiresAt: true,
      },
    });
    return locks.map((lock) => toView(lock, currentUserId));
  } catch (error) {
    if (isWidgetLockTableMissingError(error)) {
      throw new WidgetLockUnavailableError();
    }
    throw error;
  }
}

export async function acquireWidgetLock(params: AcquireWidgetLockParams) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getWidgetLockTtlMs());

  try {
    const lock = await prisma.$transaction(async (tx) => {
      await tx.widgetLock.deleteMany({
        where: {
          widgetId: params.widgetId,
          expiresAt: {
            lte: now,
          },
        },
      });

      if (params.force && params.canForce) {
        return tx.widgetLock.upsert({
          where: { widgetId: params.widgetId },
          update: {
            dashboardId: params.dashboardId,
            userId: params.userId,
            displayName: params.displayName,
            expiresAt,
          },
          create: {
            widgetId: params.widgetId,
            dashboardId: params.dashboardId,
            userId: params.userId,
            displayName: params.displayName,
            expiresAt,
          },
          select: {
            widgetId: true,
            dashboardId: true,
            userId: true,
            displayName: true,
            expiresAt: true,
          },
        });
      }

      try {
        return await tx.widgetLock.create({
          data: {
            widgetId: params.widgetId,
            dashboardId: params.dashboardId,
            userId: params.userId,
            displayName: params.displayName,
            expiresAt,
          },
          select: {
            widgetId: true,
            dashboardId: true,
            userId: true,
            displayName: true,
            expiresAt: true,
          },
        });
      } catch (error) {
        if (!isWidgetLockUniqueConstraintError(error)) {
          throw error;
        }
      }

      const existing = await tx.widgetLock.findUnique({
        where: { widgetId: params.widgetId },
        select: {
          widgetId: true,
          dashboardId: true,
          userId: true,
          displayName: true,
          expiresAt: true,
        },
      });

      if (!existing) {
        return tx.widgetLock.create({
          data: {
            widgetId: params.widgetId,
            dashboardId: params.dashboardId,
            userId: params.userId,
            displayName: params.displayName,
            expiresAt,
          },
          select: {
            widgetId: true,
            dashboardId: true,
            userId: true,
            displayName: true,
            expiresAt: true,
          },
        });
      }

      if (!isActiveLock(existing, now)) {
        return tx.widgetLock.update({
          where: { widgetId: params.widgetId },
          data: {
            dashboardId: params.dashboardId,
            userId: params.userId,
            displayName: params.displayName,
            expiresAt,
          },
          select: {
            widgetId: true,
            dashboardId: true,
            userId: true,
            displayName: true,
            expiresAt: true,
          },
        });
      }

      if (existing.userId !== params.userId) {
        throw new WidgetLockConflictError(existing);
      }

      return tx.widgetLock.update({
        where: { widgetId: params.widgetId },
        data: {
          dashboardId: params.dashboardId,
          displayName: params.displayName,
          expiresAt,
        },
        select: {
          widgetId: true,
          dashboardId: true,
          userId: true,
          displayName: true,
          expiresAt: true,
        },
      });
    });

    return toView(lock, params.userId);
  } catch (error) {
    if (error instanceof WidgetLockConflictError) {
      throw error;
    }
    if (isWidgetLockTableMissingError(error)) {
      throw new WidgetLockUnavailableError();
    }
    throw error;
  }
}

export async function releaseWidgetLock(params: ReleaseWidgetLockParams) {
  const now = new Date();
  try {
    await prisma.widgetLock.deleteMany({
      where: {
        widgetId: params.widgetId,
        expiresAt: {
          lte: now,
        },
      },
    });

    const existing = await prisma.widgetLock.findUnique({
      where: { widgetId: params.widgetId },
      select: {
        widgetId: true,
        dashboardId: true,
        userId: true,
        displayName: true,
        expiresAt: true,
      },
    });

    if (!existing || !isActiveLock(existing, now)) {
      return null;
    }

    const canRelease =
      existing.userId === params.userId || Boolean(params.force && params.canForce);
    if (!canRelease) {
      throw new WidgetLockConflictError(existing);
    }

    await prisma.widgetLock.deleteMany({
      where: {
        widgetId: params.widgetId,
        userId:
          existing.userId === params.userId || !params.force
            ? existing.userId
            : undefined,
      },
    });

    return toView(existing, params.userId);
  } catch (error) {
    if (isWidgetLockTableMissingError(error)) {
      throw new WidgetLockUnavailableError();
    }
    throw error;
  }
}

export async function releaseAllWidgetLocksByUser(
  dashboardId: string,
  userId: string
) {
  try {
    const existing = await prisma.widgetLock.findMany({
      where: { dashboardId, userId },
      select: {
        widgetId: true,
        dashboardId: true,
        userId: true,
        displayName: true,
        expiresAt: true,
      },
    });
    if (existing.length === 0) return [];

    await prisma.widgetLock.deleteMany({
      where: { dashboardId, userId },
    });
    return existing.map((lock) => toView(lock, userId));
  } catch (error) {
    if (isWidgetLockTableMissingError(error)) {
      throw new WidgetLockUnavailableError();
    }
    throw error;
  }
}

export async function ensureWidgetLockWriteAccess(
  widgetId: string,
  userId: string
) {
  const now = new Date();
  try {
    await prisma.widgetLock.deleteMany({
      where: {
        widgetId,
        expiresAt: {
          lte: now,
        },
      },
    });

    const lock = await prisma.widgetLock.findUnique({
      where: { widgetId },
      select: {
        widgetId: true,
        dashboardId: true,
        userId: true,
        displayName: true,
        expiresAt: true,
      },
    });

    if (!lock) return;
    if (!isActiveLock(lock, now)) return;
    if (lock.userId === userId) return;
    throw new WidgetLockConflictError(lock);
  } catch (error) {
    if (isWidgetLockTableMissingError(error)) {
      return;
    }
    throw error;
  }
}
