import { describe, expect, it } from "vitest";

import { playsHref, playsQueryFromUrl } from "@/app/plays/plays-page-client";
import {
  preordersHref,
  preordersQueryFromUrl,
} from "@/app/preorders/preorders-page-client";

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
});
