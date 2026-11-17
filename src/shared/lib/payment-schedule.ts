import { z } from "zod";
import { calendarToIso } from "./calendar-date";

export const paymentScheduleSchema = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        date: z
          .string()
          .refine(
            (value) =>
              /^\d{4}-\d{2}-\d{2}$/.test(value) &&
              Boolean(calendarToIso(value)),
            "Укажите существующую дату",
          ),
        amount: z
          .string()
          .regex(
            /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
            "Укажите сумму с точностью до копейки",
          )
          .refine((value) => Number(value) > 0),
        paid: z.boolean(),
      })
      .strict(),
  )
  .max(120)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "Повтор строки платежа",
  );
export type PaymentRow = z.infer<typeof paymentScheduleSchema>[number];
const cents = (value: string) => {
  const [whole, part = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(part.padEnd(2, "0").slice(0, 2));
};
const amount = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
export function paymentSummary(total: string, rows: PaymentRow[]) {
  const cost = cents(total);
  const paid = rows
    .filter((row) => row.paid)
    .reduce((sum, row) => sum + cents(row.amount), 0n);
  const planned = rows.reduce((sum, row) => sum + cents(row.amount), 0n);
  const next =
    [...rows]
      .filter((row) => !row.paid)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return {
    paid: amount(paid),
    remaining: amount(cost > paid ? cost - paid : 0n),
    excess: amount(paid > cost ? paid - cost : 0n),
    planMatches: planned === cost,
    next,
    state: paid >= cost ? "paid" : paid > 0n ? "partial" : "unpaid",
  } as const;
}
