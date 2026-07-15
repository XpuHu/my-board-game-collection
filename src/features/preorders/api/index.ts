import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  PaginatedResponse,
  PreorderListItemDto,
  PreorderQueryDto,
} from "@/shared/api/types";

export type PreordersListQuery = PreorderQueryDto & {
  page?: number;
  pageSize?: number;
};
export type PreordersListResult = PaginatedResponse<PreorderListItemDto>;

export const preordersRestAdapter = createRestQueryAdapter<
  PreordersListQuery,
  PreordersListResult
>({
  path: "/api/preorders",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createPreordersMockAdapter = (
  resolve:
    | PreordersListResult
    | ((
        params: PreordersListQuery,
      ) => PreordersListResult | Promise<PreordersListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<PreordersListQuery, PreordersListResult>(resolve, {
    delay,
  });
