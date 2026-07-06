import { NextResponse } from "next/server";

import { addToWishlistRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { addItemToWishlist } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;

    await parseJsonBody(request, addToWishlistRequestSchema);

    return NextResponse.json(await addItemToWishlist(itemId));
  });
}
