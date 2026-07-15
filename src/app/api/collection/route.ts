import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseCollectionQuery } from "@/server/api/query-contracts";
import {
  listCollection,
  listCollectionCards,
} from "@/server/application/collection/collection-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    const { page, pageSize, view, ...query } = parseCollectionQuery(searchParams);
    const pagination = { page, pageSize };
    const response =
      view === "legacy"
        ? await listCollection(query, pagination)
        : await listCollectionCards(query, pagination);

    return NextResponse.json(response);
  });
}
