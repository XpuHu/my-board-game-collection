import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  StatisticsOverviewDto,
  StatisticsQueryDto,
} from "@/shared/api/types";

export const statisticsRestAdapter = createRestQueryAdapter<
  StatisticsQueryDto,
  StatisticsOverviewDto
>({
  path: "/api/statistics/overview",
  toQuery: (query) => query,
});

export const createStatisticsMockAdapter = (
  data: StatisticsOverviewDto,
  delay = 0,
) =>
  createMockQueryAdapter<StatisticsQueryDto, StatisticsOverviewDto>(data, {
    delay,
  });
