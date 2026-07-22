import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type {
  AddToCollectionRequest,
  PaginatedResponse,
  UserItemDto,
  WishlistCardDto,
  WishlistItemDetailDto,
  WishlistQueryDto,
  CreatePreorderRequest,
  UpdateUserItemRequest,
} from "@/shared/api/types";
import { apiRequest } from "@/shared/api/client";

export type WishlistListQuery = WishlistQueryDto;
export type WishlistListResult = PaginatedResponse<WishlistCardDto>;

export const wishlistRestAdapter = createRestQueryAdapter<
  WishlistListQuery,
  WishlistListResult
>({
  path: "/api/wishlist",
  toQuery: (params) => ({ view: "compact", ...params }),
});

export const createWishlistMockAdapter = (
  resolve:
    | WishlistListResult
    | ((
        params: WishlistListQuery,
      ) => WishlistListResult | Promise<WishlistListResult>),
  delay = 0,
) =>
  createMockQueryAdapter<WishlistListQuery, WishlistListResult>(resolve, {
    delay,
  });

export function removeWishlistItem(itemId: string) {
  return apiRequest<UserItemDto>(`/api/wishlist/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

export function addWishlistItemToCollection(
  itemId: string,
  body: AddToCollectionRequest = {},
) {
  return apiRequest(`/api/items/${encodeURIComponent(itemId)}/collection`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export const wishlistDetailRestAdapter = {
  load(
    { itemId }: { itemId: string },
    context?: { signal?: AbortSignal },
  ) {
    return apiRequest<WishlistItemDetailDto>(
      `/api/wishlist/${encodeURIComponent(itemId)}`,
      { signal: context?.signal },
    );
  },
};

export function updateWishlistUserData(
  itemId: string,
  body: UpdateUserItemRequest,
) {
  return apiRequest<UserItemDto>(
    `/api/items/${encodeURIComponent(itemId)}/user-item`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function createWishlistPreorder(
  itemId: string,
  body: CreatePreorderRequest,
) {
  return apiRequest<unknown>(
    `/api/items/${encodeURIComponent(itemId)}/preorders`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
