import { describe, expect, it } from "vitest";
import { getSummaryWindow } from "./window";

describe("getSummaryWindow", () => {
  it("returns the previous 7 complete days for the selected weekday", () => {
    const baseDate = new Date(2026, 2, 18, 9, 30, 0); // 2026-03-18, Wednesday
    const result = getSummaryWindow(3, baseDate);

    expect(result.windowStartYmd).toBe("2026-03-11");
    expect(result.windowEndYmd).toBe("2026-03-18");
  });

  it("keeps the last completed window before the next scheduled weekday", () => {
    const baseDate = new Date(2026, 2, 17, 21, 0, 0); // Tuesday
    const result = getSummaryWindow(3, baseDate);

    expect(result.windowStartYmd).toBe("2026-03-04");
    expect(result.windowEndYmd).toBe("2026-03-11");
  });
});
