import { NextResponse } from "next/server";

import { updatePreorderExpectedDateRequestSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseResponseView } from "@/server/api/query-contracts";
import { parseJsonBody } from "@/server/api/request";
import {
  updatePreorderExpectedDate,
  updatePreorderExpectedDateTarget,
} from "@/server/application/preorders/preorder-service";

type RouteContext = {
  params: Promise<{
    preorderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { preorderId } = await context.params;
    const input = await parseJsonBody(
      request,
      updatePreorderExpectedDateRequestSchema,
    );
    const view = parseResponseView(new URL(request.url).searchParams);

    return NextResponse.json(
      view === "legacy"
        ? await updatePreorderExpectedDate(preorderId, input)
        : await updatePreorderExpectedDateTarget(preorderId, input),
    );
  });
}
