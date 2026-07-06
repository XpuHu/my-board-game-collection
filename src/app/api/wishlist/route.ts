import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parsePagination } from "@/server/api/pagination";
import {
  getBooleanSearchParam,
  getNumberSearchParam,
  getSearchParam,
} from "@/server/api/request";
import { listWishlist } from "@/server/application/wishlist/wishlist-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    return NextResponse.json(
      await listWishlist(
        {
          q: getSearchParam(searchParams, "q"),
          minRating: getNumberSearchParam(searchParams, "minRating"),
          players: getNumberSearchParam(searchParams, "players"),
          maxPlayTime: getNumberSearchParam(searchParams, "maxPlayTime"),
          mechanics: searchParams.getAll("mechanics"),
          categories: searchParams.getAll("categories"),
          hasPrice: getBooleanSearchParam(searchParams, "hasPrice"),
        },
        parsePagination(searchParams),
      ),
    );
  });
}
