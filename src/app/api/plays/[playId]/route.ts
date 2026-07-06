import { NextResponse } from "next/server";

import { updatePlaySessionRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import {
  deletePlaySession,
  updatePlaySession,
} from "@/server/application/plays/play-service";

type RouteContext = {
  params: Promise<{
    playId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { playId } = await context.params;
    const input = await parseJsonBody(request, updatePlaySessionRequestSchema);

    return NextResponse.json(await updatePlaySession(playId, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { playId } = await context.params;

    await deletePlaySession(playId);

    return new NextResponse(null, { status: 204 });
  });
}
