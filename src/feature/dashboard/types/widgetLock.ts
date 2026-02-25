import type { Id } from "@/shared/db/schema";

export type WidgetLock = {
  widgetId: Id;
  userId: Id;
  displayName: string;
  expiresAt: string;
  isMine: boolean;
};

export type WidgetLockMap = Record<Id, WidgetLock>;
