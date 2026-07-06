import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { getWishlistItem } from "@/server/application/wishlist/wishlist-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;

    return NextResponse.json(await getWishlistItem(itemId));
  });
}
