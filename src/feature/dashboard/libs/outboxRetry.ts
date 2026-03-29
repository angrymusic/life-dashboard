export const OUTBOX_RETRY_BASE_DELAY_MS = 3_000;
export const OUTBOX_RETRY_MAX_DELAY_MS = 60_000;

export function getOutboxRetryDelay(attempt: number) {
  const safeAttempt =
    Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  return Math.min(
    OUTBOX_RETRY_BASE_DELAY_MS * 2 ** (safeAttempt - 1),
    OUTBOX_RETRY_MAX_DELAY_MS
  );
}
