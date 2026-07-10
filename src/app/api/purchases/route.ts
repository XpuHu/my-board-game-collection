import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { listPurchases } from "@/server/application/purchases/purchase-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    return NextResponse.json(await listPurchases());
  });
}
