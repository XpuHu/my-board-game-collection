import { NextResponse } from "next/server";

import { updatePurchaseRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deletePurchase,
  updatePurchase,
} from "@/server/application/purchases/purchase-service";

type RouteContext = {
  params: Promise<{
    purchaseId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { purchaseId } = await context.params;
    const input = await parseJsonBody(request, updatePurchaseRequestSchema);

    return NextResponse.json(await updatePurchase(purchaseId, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { purchaseId } = await context.params;

    await deletePurchase(purchaseId);

    return new NextResponse(null, { status: 204 });
  });
}
