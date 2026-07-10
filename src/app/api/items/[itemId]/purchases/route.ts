import { NextResponse } from "next/server";

import { createPurchaseRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { createPurchase } from "@/server/application/purchases/purchase-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, createPurchaseRequestSchema);

    return NextResponse.json(await createPurchase(itemId, input), {
      status: 201,
    });
  });
}
