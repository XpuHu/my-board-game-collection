import { NextResponse } from "next/server";

import { syncBggPlaysRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { syncBggPlays } from "@/server/application/bgg-sync/bgg-sync-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const input = await parseJsonBody(request, syncBggPlaysRequestSchema);

    return NextResponse.json(await syncBggPlays(input));
  });
}
