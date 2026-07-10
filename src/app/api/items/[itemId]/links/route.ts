import { NextResponse } from "next/server";

import { createLinkRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { createLink } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, createLinkRequestSchema);

    return NextResponse.json(await createLink(itemId, input), {
      status: 201,
    });
  });
}
