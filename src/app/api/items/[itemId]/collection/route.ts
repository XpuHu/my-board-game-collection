import { NextResponse } from "next/server";

import { addToCollectionRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { addItemToCollection } from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, addToCollectionRequestSchema);

    return NextResponse.json(await addItemToCollection(itemId, input));
  });
}
