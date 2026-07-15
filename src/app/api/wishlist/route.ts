import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseWishlistQuery } from "@/server/api/query-contracts";
import {
  listWishlist,
  listWishlistCards,
} from "@/server/application/wishlist/wishlist-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    const { page, pageSize, view, ...query } = parseWishlistQuery(searchParams);
    const pagination = { page, pageSize };
    const response =
      view === "legacy"
        ? await listWishlist(query, pagination)
        : await listWishlistCards(query, pagination);

    return NextResponse.json(response);
  });
}
