import { NextResponse } from "next/server";

import { updateLinkRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deleteLink,
  updateLink,
} from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
    linkId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, linkId } = await context.params;
    const input = await parseJsonBody(request, updateLinkRequestSchema);

    return NextResponse.json(await updateLink(itemId, linkId, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, linkId } = await context.params;

    return NextResponse.json(await deleteLink(itemId, linkId));
  });
}
