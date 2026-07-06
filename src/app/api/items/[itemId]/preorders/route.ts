import { NextResponse } from "next/server";

import { createPreorderRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { createPreorder } from "@/server/application/preorders/preorder-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, createPreorderRequestSchema);

    return NextResponse.json(await createPreorder(itemId, input), {
      status: 201,
    });
  });
}
