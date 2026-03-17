import { describe, expect, it } from "vitest";
import {
  TRANSIENT_WIDGET_NOT_FOUND_WINDOW_MS,
  shouldRetryMissingWidget,
} from "./retry";

describe("shouldRetryMissingWidget", () => {
  it("retries a recent Widget not found error", () => {
    expect(
      shouldRetryMissingWidget({
        errorMessage: "Widget not found",
        widgetCreatedAt: "2026-03-18T10:00:00.000Z",
        now:
          Date.parse("2026-03-18T10:00:00.000Z") +
          TRANSIENT_WIDGET_NOT_FOUND_WINDOW_MS -
          1,
      }),
    ).toBe(true);
  });

  it("stops retrying after the transient window passes", () => {
    expect(
      shouldRetryMissingWidget({
        errorMessage: "Widget not found",
        widgetCreatedAt: "2026-03-18T10:00:00.000Z",
        now:
          Date.parse("2026-03-18T10:00:00.000Z") +
          TRANSIENT_WIDGET_NOT_FOUND_WINDOW_MS +
          1,
      }),
    ).toBe(false);
  });

  it("does not retry other errors", () => {
    expect(
      shouldRetryMissingWidget({
        errorMessage: "Failed to load summary",
        widgetCreatedAt: "2026-03-18T10:00:00.000Z",
      }),
    ).toBe(false);
  });
});
