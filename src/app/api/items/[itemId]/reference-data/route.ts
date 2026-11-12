import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  referenceCommandSchema,
  saveReferenceCommand,
} from "@/server/application/items/reference-command";
import { getItemCard } from "@/server/application/items/item-service";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    await saveReferenceCommand(
      itemId,
      await parseJsonBody(request, referenceCommandSchema),
    );
    return NextResponse.json(await getItemCard(itemId));
  });
}
