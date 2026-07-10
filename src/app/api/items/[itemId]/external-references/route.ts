import { NextResponse } from "next/server";

import { createExternalReferenceRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { createExternalReference } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(
      request,
      createExternalReferenceRequestSchema,
    );

    return NextResponse.json(await createExternalReference(itemId, input), {
      status: 201,
    });
  });
}
