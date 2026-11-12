import { getGameExpansionOptions } from "@/server/application/items/expansion-options-service";
import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  attachExpansions,
  attachExpansionsSchema,
} from "@/server/application/items/expansion-service";
export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    return NextResponse.json(
      await attachExpansions(
        itemId,
        await parseJsonBody(request, attachExpansionsSchema),
      ),
    );
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    return NextResponse.json(
      await getGameExpansionOptions(
        itemId,
        new URL(request.url).searchParams.get("kind") === "accessory"
          ? "accessory"
          : "expansion",
      ),
    );
  });
}
