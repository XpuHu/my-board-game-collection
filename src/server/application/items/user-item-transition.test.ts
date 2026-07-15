import { describe, expect, it } from "vitest";

import {
  collectionTransition,
  resolveUserItemTransition,
  wishlistTransition,
} from "./user-item-transition";

describe("UserItem transitions", () => {
  it("moves an existing wishlist entry into collection atomically", () => {
    expect(
      resolveUserItemTransition(
        { owned: false, wishlist: true, status: "wishlist" },
        collectionTransition(),
      ),
    ).toEqual({ owned: true, wishlist: false, status: "active" });
  });

  it("rejects owned plus wishlist and for-sale without ownership", () => {
    expect(() =>
      resolveUserItemTransition(
        { owned: true, wishlist: false, status: "active" },
        { wishlist: true },
      ),
    ).toThrowError(/cannot be owned and in the wishlist/i);
    expect(() =>
      resolveUserItemTransition(null, { status: "for_sale" }),
    ).toThrowError(/only an owned item/i);
  });

  it.each(["sold", "archived"] as const)(
    "%s clears both catalog flags",
    (status) => {
      expect(
        resolveUserItemTransition(
          { owned: true, wishlist: false, status: "active" },
          { status },
        ),
      ).toEqual({ owned: false, wishlist: false, status });
    },
  );

  it("rejects moving an owned item to wishlist without removing ownership", () => {
    expect(() =>
      wishlistTransition({ owned: true, wishlist: false, status: "active" }),
    ).toThrowError(/cannot be added to the wishlist/i);
  });
});
