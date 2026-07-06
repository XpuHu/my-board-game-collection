import { NextResponse } from "next/server";

import { createPlaySessionRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { createPlaySession } from "@/server/application/plays/play-service";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { itemId } = await context.params;
    const input = await parseJsonBody(request, createPlaySessionRequestSchema);

    return NextResponse.json(await createPlaySession(itemId, input), {
      status: 201,
    });
  });
}
