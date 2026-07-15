import { NextResponse } from "next/server";

import { parsePlaysQuery } from "@/server/api/query-contracts";
import { withApiErrorHandling } from "@/server/api/errors";
import {
  listPlayItems,
  listPlaySessions,
} from "@/server/application/plays/play-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, view, ...query } = parsePlaysQuery(searchParams);
    const pagination = { page, pageSize };
    const response =
      view === "legacy"
        ? await listPlaySessions(query, pagination)
        : await listPlayItems(query, pagination);

    return NextResponse.json(response);
  });
}
