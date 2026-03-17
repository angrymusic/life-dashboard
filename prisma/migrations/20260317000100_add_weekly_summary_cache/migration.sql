CREATE TABLE "WeeklySummary" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "windowStartYmd" TEXT NOT NULL,
    "windowEndYmd" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "stats" JSONB,
    "model" TEXT,
    "generatedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklySummary_widgetId_windowStartYmd_key"
ON "WeeklySummary"("widgetId", "windowStartYmd");

CREATE INDEX "WeeklySummary_dashboardId_windowStartYmd_idx"
ON "WeeklySummary"("dashboardId", "windowStartYmd");

ALTER TABLE "WeeklySummary"
ADD CONSTRAINT "WeeklySummary_widgetId_fkey"
FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklySummary"
ADD CONSTRAINT "WeeklySummary_dashboardId_fkey"
FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
