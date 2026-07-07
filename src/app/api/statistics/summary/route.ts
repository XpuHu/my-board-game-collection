import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { getStatisticsSummary } from "@/server/application/statistics/statistics-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    return NextResponse.json(await getStatisticsSummary());
  });
}
