import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { withApiErrorHandling, ApiError } from "@/server/api/errors";
import { paymentScheduleSchema } from "@/shared/lib/payment-schedule";

const inputSchema = z
  .object({
    version: z.number().int().nonnegative(),
    rows: paymentScheduleSchema,
  })
  .strict();
export async function PUT(
  request: Request,
  context: { params: Promise<{ preorderId: string }> },
) {
  return withApiErrorHandling(async () => {
    const input = inputSchema.parse(await request.json());
    const { preorderId } = await context.params;
    const changed = await prisma.preorder.updateMany({
      where: {
        id: preorderId,
        parentId: null,
        paymentVersion: input.version,
        OR: [
          { fullyPaid: false },
          { fullyPaid: null, status: { not: "paid" } },
        ],
        item: { deletedAt: null },
      },
      data: { paymentSchedule: input.rows, paymentVersion: { increment: 1 } },
    });
    if (!changed.count)
      throw ApiError.conflict(
        "PAYMENT_SCHEDULE_CHANGED",
        "График изменён в другом окне либо заказ недоступен. Обновите страницу перед повтором.",
      );
    return NextResponse.json({ rows: input.rows, version: input.version + 1 });
  });
}
