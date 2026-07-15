import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type { StatisticsOverviewDto } from "@/shared/api/types";

export const statisticsRestAdapter = createRestQueryAdapter<
  void,
  StatisticsOverviewDto
>({
  path: "/api/statistics/overview",
});

export const createStatisticsMockAdapter = (
  data: StatisticsOverviewDto,
  delay = 0,
) => createMockQueryAdapter<void, StatisticsOverviewDto>(data, { delay });
