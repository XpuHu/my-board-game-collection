import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  PaginatedResponse,
  PlayListItemDto,
  PlaysQueryDto,
} from "@/shared/api/types";

export type PlaysListQuery = PlaysQueryDto & {
  page?: number;
  pageSize?: number;
};
export type PlaysListResult = PaginatedResponse<PlayListItemDto>;

export const playsRestAdapter = createRestQueryAdapter<
  PlaysListQuery,
  PlaysListResult
>({
  path: "/api/plays",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createPlaysMockAdapter = (
  resolve:
    | PlaysListResult
    | ((params: PlaysListQuery) => PlaysListResult | Promise<PlaysListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<PlaysListQuery, PlaysListResult>(resolve, { delay });
