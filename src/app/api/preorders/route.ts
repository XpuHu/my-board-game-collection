import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parsePreorderQuery } from "@/server/api/query-contracts";
import {
  listPreorderItems,
  listPreorders,
} from "@/server/application/preorders/preorder-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    const { page, pageSize, view, ...query } = parsePreorderQuery(searchParams);
    const response = view === "legacy"
      ? await listPreorders()
      : await listPreorderItems(query, { page, pageSize });

    return NextResponse.json(response);
  });
}
