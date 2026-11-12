import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  CollectionCardDto,
  CollectionItemDetailDto,
  CollectionQueryDto,
  PaginatedResponse,
  UserItemDto,
} from "@/shared/api/types";
import { apiRequest } from "@/shared/api/client";

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

export const collectionDetailRestAdapter = {
  load(
    { itemId }: { itemId: string },
    context?: { signal?: AbortSignal },
  ): Promise<CollectionItemDetailDto> {
    return apiRequest(`/api/collection/${encodeURIComponent(itemId)}`, {
      signal: context?.signal,
    });
  },
};

export function updateCollectionFavorite(itemId: string, favorite: boolean) {
  return apiRequest<UserItemDto>(
    `/api/items/${encodeURIComponent(itemId)}/user-item`,
    {
      method: "PATCH",
      body: JSON.stringify({ favorite }),
    },
  );
}

export const itemCardRestAdapter = {
  async load(
    { itemId }: { itemId: string },
    context?: { signal?: AbortSignal },
  ): Promise<CollectionItemDetailDto> {
    const data = await apiRequest<import("@/shared/api").ItemCardDto>(
      `/api/items/${encodeURIComponent(itemId)}`,
      { signal: context?.signal },
    );
    // Empty personal controls are a client view model. GET never creates a UserItem.
    return {
      ...data,
      userItem: data.userItem ?? {
        id: "",
        owned: false,
        wishlist: false,
        states: [],
        lifecycleStatus: "active",
        ownedAt: null,
        favorite: false,
        tags: [],
      },
    };
  },
};
