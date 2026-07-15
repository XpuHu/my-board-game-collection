import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  CollectionCardDto,
  CollectionQueryDto,
  PaginatedResponse,
} from "@/shared/api/types";

export type CollectionListQuery = CollectionQueryDto & {
  page?: number;
  pageSize?: number;
};
export type CollectionListResult = PaginatedResponse<CollectionCardDto>;

export const collectionRestAdapter = createRestQueryAdapter<
  CollectionListQuery,
  CollectionListResult
>({
  path: "/api/collection",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createCollectionMockAdapter = (
  resolve:
    | CollectionListResult
    | ((
        params: CollectionListQuery,
      ) => CollectionListResult | Promise<CollectionListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<CollectionListQuery, CollectionListResult>(resolve, {
    delay,
  });
