import { NextResponse } from "next/server";

import { providerCodeSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { getSearchParam } from "@/server/api/request";
import { searchExternalItems } from "@/server/application/search/external-search-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const provider = getSearchParam(searchParams, "provider");

    return NextResponse.json(
      await searchExternalItems({
        q: getSearchParam(searchParams, "q"),
        provider: provider ? providerCodeSchema.parse(provider) : undefined,
        type: getSearchParam(searchParams, "type"),
      }),
    );
  });
}
