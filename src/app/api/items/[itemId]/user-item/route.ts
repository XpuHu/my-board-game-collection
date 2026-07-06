import { NextResponse } from "next/server";

import { updateUserItemRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { updateUserItem } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, updateUserItemRequestSchema);

    return NextResponse.json(await updateUserItem(itemId, input));
  });
}
