import { NextResponse } from "next/server";

import { syncItemRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { syncItemReference } from "@/server/application/synchronization/item-sync-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, syncItemRequestSchema);

    return NextResponse.json(await syncItemReference(itemId, input));
  });
}
