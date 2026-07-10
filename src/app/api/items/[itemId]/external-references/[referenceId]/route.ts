import { NextResponse } from "next/server";

import { updateExternalReferenceRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deleteExternalReference,
  updateExternalReference,
} from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
    referenceId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, referenceId } = await context.params;
    const input = await parseJsonBody(
      request,
      updateExternalReferenceRequestSchema,
    );

    return NextResponse.json(
      await updateExternalReference(itemId, referenceId, input),
    );
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, referenceId } = await context.params;

    return NextResponse.json(
      await deleteExternalReference(itemId, referenceId),
    );
  });
}
