import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { paymentSummary, paymentScheduleSchema } from "./payment-schedule";
describe("manual lot payments", () => {
  it("keeps overdue first, sums marked rows exactly and detects edited total", () => {
    const rows = [
      { id: randomUUID(), date: "2027-01-01", amount: "0.10", paid: true },
      { id: randomUUID(), date: "2027-01-03", amount: "0.20", paid: true },
      { id: randomUUID(), date: "2020-01-01", amount: "7.00", paid: false },
    ];
    expect(paymentSummary("10.00", rows)).toMatchObject({
      paid: "0.30",
      remaining: "9.70",
      state: "partial",
      next: rows[2],
      planMatches: false,
    });
    expect(paymentSummary("0.20", rows)).toMatchObject({
      remaining: "0.00",
      excess: "0.10",
      state: "paid",
    });
  });
  it("rejects invalid dates, duplicate ids and nonpositive or overprecise amounts", () => {
    const row = {
      id: randomUUID(),
      date: "2027-02-28",
      amount: "1.00",
      paid: false,
    };
    expect(paymentScheduleSchema.safeParse([row]).success).toBe(true);
    expect(paymentScheduleSchema.safeParse([row, row]).success).toBe(false);
    for (const patch of [
      { date: "2027-02-30" },
      { amount: "0" },
      { amount: "1.001" },
      { amount: "-1" },
    ])
      expect(
        paymentScheduleSchema.safeParse([{ ...row, ...patch }]).success,
      ).toBe(false);
  });
});
