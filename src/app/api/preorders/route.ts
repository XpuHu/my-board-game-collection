import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { listPreorders } from "@/server/application/preorders/preorder-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    return NextResponse.json(await listPreorders());
  });
}
