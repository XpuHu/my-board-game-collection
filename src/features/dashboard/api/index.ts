import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type { DashboardDto } from "@/shared/api/types";

export const dashboardRestAdapter = createRestQueryAdapter<void, DashboardDto>({
  path: "/api/dashboard",
});

export const createDashboardMockAdapter = (data: DashboardDto, delay = 0) =>
  createMockQueryAdapter<void, DashboardDto>(data, { delay });
