import { NextResponse } from "next/server";

import { updatePreorderExpectedDateRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { updatePreorderExpectedDate } from "@/server/application/preorders/preorder-service";

type RouteContext = {
  params: Promise<{
    preorderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { preorderId } = await context.params;
    const input = await parseJsonBody(
      request,
      updatePreorderExpectedDateRequestSchema,
    );

    return NextResponse.json(
      await updatePreorderExpectedDate(preorderId, input),
    );
  });
}
