import { describe, expect, it } from "vitest";
import {
  getOutboxRetryDelay,
  OUTBOX_RETRY_BASE_DELAY_MS,
  OUTBOX_RETRY_MAX_DELAY_MS,
} from "./outboxRetry";

describe("getOutboxRetryDelay", () => {
  it("uses the base delay for the first retry", () => {
    expect(getOutboxRetryDelay(1)).toBe(OUTBOX_RETRY_BASE_DELAY_MS);
  });

  it("doubles the delay for subsequent retries", () => {
    expect(getOutboxRetryDelay(2)).toBe(OUTBOX_RETRY_BASE_DELAY_MS * 2);
    expect(getOutboxRetryDelay(3)).toBe(OUTBOX_RETRY_BASE_DELAY_MS * 4);
  });

  it("caps the retry delay", () => {
    expect(getOutboxRetryDelay(100)).toBe(OUTBOX_RETRY_MAX_DELAY_MS);
  });

  it("falls back to the base delay for invalid attempts", () => {
    expect(getOutboxRetryDelay(0)).toBe(OUTBOX_RETRY_BASE_DELAY_MS);
    expect(getOutboxRetryDelay(Number.NaN)).toBe(OUTBOX_RETRY_BASE_DELAY_MS);
  });
});
