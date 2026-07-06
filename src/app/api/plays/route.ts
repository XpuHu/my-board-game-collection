import { NextResponse } from "next/server";

import { parsePagination } from "@/server/api/pagination";
import { getSearchParam } from "@/server/api/request";
import { withApiErrorHandling } from "@/server/api/errors";
import { listPlaySessions } from "@/server/application/plays/play-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const source = getSearchParam(searchParams, "source");

    return NextResponse.json(
      await listPlaySessions(
        {
          itemId: getSearchParam(searchParams, "itemId"),
          from: getSearchParam(searchParams, "from"),
          to: getSearchParam(searchParams, "to"),
          source:
            source === "manual" || source === "boardgamegeek"
              ? source
              : undefined,
        },
        parsePagination(searchParams),
      ),
    );
  });
}
