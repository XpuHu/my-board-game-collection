import type { UserItemLifecycleStatus } from "@/shared/api";
import { ApiError } from "@/server/api/errors";

import { resolveLifecycleStatus } from "./user-item-state";

export type UserItemTransitionState = {
  owned: boolean;
  wishlist: boolean;
  status: string;
  ownedAt?: Date | null;
};

export type UserItemTransitionPatch = {
  owned?: boolean;
  wishlist?: boolean;
  status?: UserItemLifecycleStatus;
};

export function resolveUserItemTransition(
  current: UserItemTransitionState | null,
  patch: UserItemTransitionPatch,
  now = new Date(),
): UserItemTransitionState & {
  status: UserItemLifecycleStatus;
  ownedAt: Date | null;
} {
  const next = {
    owned: patch.owned ?? current?.owned ?? false,
    wishlist: patch.wishlist ?? current?.wishlist ?? false,
    status: patch.status ?? resolveLifecycleStatus(current?.status ?? "active"),
    ownedAt: current?.ownedAt ?? null,
  };

  if (!current?.owned && next.owned && next.ownedAt === null) {
    next.ownedAt = now;
  }

  if (next.status === "sold" || next.status === "archived") {
    next.owned = false;
    next.wishlist = false;
  }

  if (next.owned && next.wishlist) {
    throw ApiError.conflict(
      "USER_ITEM_STATE_CONFLICT",
      "An item cannot be owned and in the wishlist at the same time",
      { owned: next.owned, wishlist: next.wishlist, status: next.status },
    );
  }

  if (next.status === "for_sale" && !next.owned) {
    throw ApiError.conflict(
      "USER_ITEM_STATE_CONFLICT",
      "Only an owned item can be marked for sale",
      { owned: next.owned, wishlist: next.wishlist, status: next.status },
    );
  }

  return next;
}

export function collectionTransition(): UserItemTransitionPatch {
  return { owned: true, wishlist: false, status: "active" };
}

export function wishlistTransition(
  current: UserItemTransitionState | null,
): UserItemTransitionPatch {
  if (current?.owned) {
    throw ApiError.conflict(
      "ITEM_ALREADY_OWNED",
      "An owned item cannot be added to the wishlist",
    );
  }

  return { owned: false, wishlist: true, status: "active" };
}
