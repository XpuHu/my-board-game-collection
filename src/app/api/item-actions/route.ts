import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  itemActionSchema,
  executeItemAction,
} from "@/server/application/items/item-action-service";
export async function POST(request: Request) {
  return withApiErrorHandling(async () =>
    NextResponse.json(
      await executeItemAction(await parseJsonBody(request, itemActionSchema)),
    ),
  );
}
