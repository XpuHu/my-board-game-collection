import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parseStatisticsQuery } from "@/server/api/query-contracts";
import { getStatisticsOverview } from "@/server/application/statistics/statistics-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const query = parseStatisticsQuery(new URL(request.url).searchParams);
    return NextResponse.json(await getStatisticsOverview(query));
  });
}
