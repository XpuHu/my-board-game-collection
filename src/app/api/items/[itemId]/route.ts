import { NextResponse } from "next/server";

import { updateItemRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { updateItem } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, updateItemRequestSchema);

    return NextResponse.json(await updateItem(itemId, input));
  });
}
