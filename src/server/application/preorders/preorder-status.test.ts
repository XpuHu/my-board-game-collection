import { describe, expect, it } from "vitest";

import { getPreorderUiStatus } from "./preorder-status";

describe("preorder UI status", () => {
  it("keeps a day-precision preorder active throughout its expected day", () => {
    const preorder = {
      status: "ordered" as const,
      expectedDate: new Date("2026-07-15T00:00:00.000Z"),
      expectedDatePrecision: "day" as const,
    };

    expect(getPreorderUiStatus(preorder, new Date("2026-07-15T23:59:59.999Z"))).toBe(
      "active",
    );
    expect(getPreorderUiStatus(preorder, new Date("2026-07-16T00:00:00.000Z"))).toBe(
      "delayed",
    );
  });

  it.each([
    ["month", "2026-07-31T23:59:59.999Z", "2026-08-01T00:00:00.000Z"],
    ["quarter", "2026-09-30T23:59:59.999Z", "2026-10-01T00:00:00.000Z"],
  ] as const)("uses the end of %s as its boundary", (precision, inside, after) => {
    const preorder = {
      status: "paid" as const,
      expectedDate: new Date("2026-07-01T00:00:00.000Z"),
      expectedDatePrecision: precision,
    };
    expect(getPreorderUiStatus(preorder, new Date(inside))).toBe("active");
    expect(getPreorderUiStatus(preorder, new Date(after))).toBe("delayed");
  });

  it("never delays unknown, received or cancelled preorders", () => {
    const expectedDate = new Date("2020-01-01T00:00:00.000Z");
    expect(
      getPreorderUiStatus({
        status: "ordered",
        expectedDate,
        expectedDatePrecision: "unknown",
      }),
    ).toBe("active");
    expect(
      getPreorderUiStatus({
        status: "received",
        expectedDate,
        expectedDatePrecision: "day",
      }),
    ).toBe("received");
    expect(
      getPreorderUiStatus({
        status: "cancelled",
        expectedDate,
        expectedDatePrecision: "day",
      }),
    ).toBe("cancelled");
  });
});
