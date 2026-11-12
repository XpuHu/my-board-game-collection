import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrorHandling } from "@/server/api/errors";
import { searchLocalItems } from "@/server/application/items/item-service";
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const params = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .positive()
      .parse(params.get("page") ?? 1);
    return NextResponse.json(
      await searchLocalItems(
        params.get("q")?.trim() ?? "",
        page,
        params.get("type") === "expansion" ? "expansion" : undefined,
      ),
    );
  });
}
