import { NextResponse } from "next/server";

import { updateImageRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deleteImage,
  updateImage,
} from "@/server/application/items/item-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
    imageId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, imageId } = await context.params;
    const input = await parseJsonBody(request, updateImageRequestSchema);

    return NextResponse.json(await updateImage(itemId, imageId, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId, imageId } = await context.params;

    return NextResponse.json(await deleteImage(itemId, imageId));
  });
}
