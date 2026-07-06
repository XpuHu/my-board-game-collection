import { NextResponse } from "next/server";

import { createPreorderRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deletePreorder,
  updatePreorder,
} from "@/server/application/preorders/preorder-service";

const updatePreorderRequestSchema = createPreorderRequestSchema.partial();

type RouteContext = {
  params: Promise<{
    preorderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { preorderId } = await context.params;
    const input = await parseJsonBody(request, updatePreorderRequestSchema);

    return NextResponse.json(await updatePreorder(preorderId, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { preorderId } = await context.params;

    await deletePreorder(preorderId);

    return new NextResponse(null, { status: 204 });
  });
}
