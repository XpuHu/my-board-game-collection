import { NextResponse } from "next/server";

import { updateItemRelationRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deleteItemRelation,
  updateItemRelation,
} from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
    relationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, relationId } = await context.params;
    const input = await parseJsonBody(request, updateItemRelationRequestSchema);
    return NextResponse.json(
      await updateItemRelation(itemId, relationId, input),
    );
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, relationId } = await context.params;
    return NextResponse.json(await deleteItemRelation(itemId, relationId));
  });
}
