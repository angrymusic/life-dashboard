-- AlterTable
ALTER TABLE "WeeklySummary"
ADD COLUMN "summaryKo" TEXT,
ADD COLUMN "summaryEn" TEXT;

UPDATE "WeeklySummary"
SET
  "summaryKo" = "summary",
  "summaryEn" = NULL
WHERE "summary" IS NOT NULL;

ALTER TABLE "WeeklySummary"
DROP COLUMN "summary";
