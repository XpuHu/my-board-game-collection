import { describe, expect, it } from "vitest";

import { playsHref, playsQueryFromUrl } from "@/app/plays/plays-page-client";
import {
  preordersHref,
  preordersQueryFromUrl,
} from "@/app/preorders/preorders-page-client";
import {
  wishlistHref,
  wishlistQueryFromUrl,
} from "@/app/wishlist/wishlist-page-client";
import { statisticsQueryFromUrl } from "@/app/statistics/statistics-page-client";

describe("P0 list URL state", () => {
  it("restores plays filters and pagination", () => {
    expect(
      playsQueryFromUrl(
        new URLSearchParams(
          "itemId=item-1&from=2026-01-01&to=2026-01-31&result=win&source=manual&player=Anna&playersMin=2&playersMax=4&durationMin=30&durationMax=120&usedItemId=item-2&page=2",
        ),
      ),
    ).toMatchObject({
      itemId: "item-1",
      from: "2026-01-01",
      to: "2026-01-31",
      result: "win",
      source: "manual",
      player: "Anna",
      playersMin: 2,
      playersMax: 4,
      durationMin: 30,
      durationMax: 120,
      usedItemId: "item-2",
      page: 2,
      pageSize: 24,
    });
    expect(playsHref(new URLSearchParams("page=2"))).toBe("/plays?page=2");
  });

  it("restores preorder group and pagination", () => {
    expect(
      preordersQueryFromUrl(
        new URLSearchParams("group=received&itemId=item-1&page=3"),
      ),
    ).toMatchObject({
      group: "received",
      itemId: "item-1",
      page: 3,
      pageSize: 24,
    });
    expect(preordersHref(new URLSearchParams("group=active"))).toBe(
      "/preorders?group=active",
    );
  });

  it("restores wishlist filters, repeated taxonomy and pagination", () => {
    expect(
      wishlistQueryFromUrl(
        new URLSearchParams(
          "q=Ark&type=base_game&ratingMin=7&players=2&playTimeMax=90&complexityMin=2&complexityMax=4&mechanic=Drafting&mechanic=Deck+Building&category=Animals&hasLocalization=true&hasPrice=true&interestLevel=5&sort=rating&direction=asc&page=2",
        ),
      ),
    ).toMatchObject({
      q: "Ark",
      type: "base_game",
      ratingMin: 7,
      players: 2,
      playTimeMax: 90,
      complexityMin: 2,
      complexityMax: 4,
      mechanic: ["Drafting", "Deck Building"],
      category: ["Animals"],
      hasLocalization: true,
      hasPrice: true,
      interestLevel: 5,
      sort: "rating",
      direction: "asc",
      page: 2,
      pageSize: 24,
    });
    expect(wishlistHref(new URLSearchParams("page=2"))).toBe(
      "/wishlist?page=2",
    );
  });

  it("restores statistics period", () => {
    expect(
      statisticsQueryFromUrl(
        new URLSearchParams(
          "period=custom&from=2026-01-01&to=2026-03-31",
        ),
      ),
    ).toEqual({
      period: "custom",
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });
});
