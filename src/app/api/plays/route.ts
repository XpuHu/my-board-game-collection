import { NextResponse } from "next/server";

import { parsePagination } from "@/server/api/pagination";
import { getNumberSearchParam, getSearchParam } from "@/server/api/request";
import { withApiErrorHandling } from "@/server/api/errors";
import {
  listPlayItems,
  listPlaySessions,
  type PlaysQuery,
} from "@/server/application/plays/play-service";
import { playResults, type PlayResult } from "@/shared/api";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const source = getSearchParam(searchParams, "source");

    const query: PlaysQuery = {
      itemId: getSearchParam(searchParams, "itemId"),
      from: getSearchParam(searchParams, "from"),
      to: getSearchParam(searchParams, "to"),
      result: parseResult(getSearchParam(searchParams, "result")),
      playerName: getSearchParam(searchParams, "playerName"),
      playersMin: getNumberSearchParam(searchParams, "playersMin"),
      playersMax: getNumberSearchParam(searchParams, "playersMax"),
      durationMin: getNumberSearchParam(searchParams, "durationMin"),
      durationMax: getNumberSearchParam(searchParams, "durationMax"),
      usedItemId: getSearchParam(searchParams, "usedItemId"),
      source:
        source === "manual" || source === "boardgamegeek" ? source : undefined,
    };
    const pagination = parsePagination(searchParams);
    const response =
      getSearchParam(searchParams, "view") === "compact"
        ? await listPlayItems(query, pagination)
        : await listPlaySessions(query, pagination);

    return NextResponse.json(response);
  });
}

function parseResult(value?: string): PlayResult | undefined {
  return playResults.includes(value as PlayResult)
    ? (value as PlayResult)
    : undefined;
}
