import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parsePagination } from "@/server/api/pagination";
import { getSearchParam } from "@/server/api/request";
import {
  listPreorderItems,
  listPreorders,
} from "@/server/application/preorders/preorder-service";
import type { PreorderQueryDto } from "@/shared/api";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    let response: unknown;

    if (getSearchParam(searchParams, "view") !== "compact") {
      response = await listPreorders();
    } else {
      const group = getSearchParam(searchParams, "group");
      const query: PreorderQueryDto = {
        group: isPreorderGroup(group) ? group : undefined,
        itemId: getSearchParam(searchParams, "itemId"),
        expectedFrom: getSearchParam(searchParams, "expectedFrom"),
        expectedTo: getSearchParam(searchParams, "expectedTo"),
      };
      response = await listPreorderItems(query, parsePagination(searchParams));
    }

    return NextResponse.json(response);
  });
}

function isPreorderGroup(
  value?: string,
): value is NonNullable<PreorderQueryDto["group"]> {
  return ["all", "active", "received", "cancelled"].includes(value ?? "");
}
