import {
  createMockQueryAdapter,
  createRestQueryAdapter,
} from "@/shared/api/query-adapter";
import type { PaginatedResponse, WishlistCardDto } from "@/shared/api/types";
import type { WishlistQuery } from "@/shared/api/client";

export type WishlistListQuery = WishlistQuery;
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
