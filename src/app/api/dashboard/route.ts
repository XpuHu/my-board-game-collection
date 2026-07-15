import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { getDashboard } from "@/server/application/dashboard/dashboard-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    return NextResponse.json(await getDashboard());
  });
}
