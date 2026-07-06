import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parsePagination } from "@/server/api/pagination";
import {
  getBooleanSearchParam,
  getNumberSearchParam,
  getSearchParam,
} from "@/server/api/request";
import { listCollection } from "@/server/application/collection/collection-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    return NextResponse.json(
      await listCollection(
        {
          q: getSearchParam(searchParams, "q"),
          type: getSearchParam(searchParams, "type"),
          rating: getNumberSearchParam(searchParams, "rating"),
          location: getSearchParam(searchParams, "location"),
          playedFrom: getSearchParam(searchParams, "playedFrom"),
          playedTo: getSearchParam(searchParams, "playedTo"),
          hasActivePreorder: getBooleanSearchParam(
            searchParams,
            "hasActivePreorder",
          ),
          tag: getSearchParam(searchParams, "tag"),
        },
        parsePagination(searchParams),
      ),
    );
  });
}
