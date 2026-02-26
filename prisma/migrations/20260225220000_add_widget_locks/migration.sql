-- CreateTable
CREATE TABLE "WidgetLock" (
    "widgetId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetLock_pkey" PRIMARY KEY ("widgetId")
);

-- CreateIndex
CREATE INDEX "WidgetLock_dashboardId_expiresAt_idx" ON "WidgetLock"("dashboardId", "expiresAt");

-- CreateIndex
CREATE INDEX "WidgetLock_userId_expiresAt_idx" ON "WidgetLock"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "WidgetLock" ADD CONSTRAINT "WidgetLock_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetLock" ADD CONSTRAINT "WidgetLock_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetLock" ADD CONSTRAINT "WidgetLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
