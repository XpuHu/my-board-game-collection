import { describe, expect, it } from "vitest";

import {
  collectionTransition,
  resolveUserItemTransition,
  wishlistTransition,
} from "./user-item-transition";

describe("UserItem transitions", () => {
  it("moves an existing wishlist entry into collection atomically", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");

    expect(
      resolveUserItemTransition(
        {
          owned: false,
          wishlist: true,
          status: "wishlist",
          ownedAt: null,
        },
        collectionTransition(),
        now,
      ),
    ).toEqual({
      owned: true,
      wishlist: false,
      status: "active",
      ownedAt: now,
    });
  });

  it("preserves the first ownedAt across edits, removal and re-adding", () => {
    const ownedAt = new Date("2026-01-10T08:00:00.000Z");
    const later = new Date("2026-07-22T12:00:00.000Z");

    const removed = resolveUserItemTransition(
      { owned: true, wishlist: false, status: "active", ownedAt },
      { owned: false },
      later,
    );
    const restored = resolveUserItemTransition(
      removed,
      collectionTransition(),
      later,
    );

    expect(removed.ownedAt).toEqual(ownedAt);
    expect(restored.ownedAt).toEqual(ownedAt);
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
      ).toEqual({ owned: false, wishlist: false, status, ownedAt: null });
    },
  );

  it("rejects moving an owned item to wishlist without removing ownership", () => {
    expect(() =>
      wishlistTransition({ owned: true, wishlist: false, status: "active" }),
    ).toThrowError(/cannot be added to the wishlist/i);
  });
});
