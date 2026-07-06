import { NextResponse } from "next/server";

import { importExternalItemRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { importExternalItem } from "@/server/application/search/external-search-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const input = await parseJsonBody(request, importExternalItemRequestSchema);

    return NextResponse.json(await importExternalItem(input), { status: 201 });
  });
}
