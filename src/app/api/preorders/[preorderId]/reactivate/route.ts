import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { reactivatePreorder } from "@/server/application/preorders/preorder-service";

type RouteContext = {
  params: Promise<{
    preorderId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return withApiErrorHandling(async () => {
    const { preorderId } = await context.params;

    return NextResponse.json(await reactivatePreorder(preorderId));
  });
}
