import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseCollectionDetailQuery } from "@/server/api/query-contracts";
import {
  getCollectionItem,
  getCollectionItemDetail,
} from "@/server/application/collection/collection-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const { view } = parseCollectionDetailQuery(new URL(request.url).searchParams);

    return NextResponse.json(
      view === "legacy"
        ? await getCollectionItem(itemId)
        : await getCollectionItemDetail(itemId),
    );
  });
}
