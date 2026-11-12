import { describe, expect, it } from "vitest";
import {
  validCalendarDay,
  validIsoDate,
  formatExpectedDate,
  formatRelativeExpectedDate,
} from "./calendar-date";
import { createPreorderRequestSchema } from "@/shared/api";
describe("MVP calendar values", () => {
  it("rejects normalized nonexistent dates and accepts leap days", () => {
    expect(validCalendarDay("2026-02-30")).toBe(false);
    expect(validCalendarDay("2024-02-29")).toBe(true);
    expect(validIsoDate("2026-02-30T00:00:00.000Z")).toBe(false);
    expect(validIsoDate("October 1 2026")).toBe(false);
  });
  it("formats calendar dates and relative days in UTC without inventing a day for a period", () => {
    const value = {
      expectedDate: "2026-11-12T00:00:00.000Z",
      expectedDatePrecision: "day" as const,
    };
    expect(formatExpectedDate(value)).toContain("12");
    expect(
      formatRelativeExpectedDate(value, new Date("2026-11-12T23:59:59Z")),
    ).toBe("сегодня");
    expect(
      formatRelativeExpectedDate({ ...value, expectedDatePrecision: "month" }),
    ).toBeNull();
    expect(
      formatExpectedDate({ ...value, expectedDatePrecision: "unknown" }),
    ).toBe("Дата неизвестна");
  });
  it("rejects currencies that would crash formatting and restricts normal creation", () => {
    const order = {
      shop: "Shop",
      price: 1.25,
      currency: "RUB",
      status: "ordered",
    };
    expect(
      createPreorderRequestSchema.safeParse({ ...order, currency: "123" })
        .success,
    ).toBe(false);
    expect(
      createPreorderRequestSchema.safeParse({ ...order, status: "received" })
        .success,
    ).toBe(false);
    expect(
      createPreorderRequestSchema.parse({ ...order, currency: "rub" }).currency,
    ).toBe("RUB");
  });
});
