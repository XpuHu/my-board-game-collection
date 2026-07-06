import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  createItem,
  createItemSchema,
} from "@/server/application/items/item-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const input = await parseJsonBody(request, createItemSchema);

    return NextResponse.json(await createItem(input), { status: 201 });
  });
}
