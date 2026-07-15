import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseWishlistDetailQuery } from "@/server/api/query-contracts";
import {
  getWishlistItem,
  getWishlistItemDetail,
} from "@/server/application/wishlist/wishlist-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const { view } = parseWishlistDetailQuery(new URL(request.url).searchParams);

    return NextResponse.json(
      view === "legacy"
        ? await getWishlistItem(itemId)
        : await getWishlistItemDetail(itemId),
    );
  });
}
