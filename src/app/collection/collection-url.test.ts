import { describe, expect, it } from "vitest";

import {
  collectionHref,
  collectionQueryFromUrl,
} from "./collection-page-client";

describe("collection URL state", () => {
  it("restores filter, sort and page from URL", () => {
    const query = collectionQueryFromUrl(
      new URLSearchParams(
        "q=ark&type=base_game&sort=title&direction=asc&playsMin=2&tag=solo&tag=co-op&page=3",
      ),
    );
    expect(query).toMatchObject({
      q: "ark",
      type: "base_game",
      sort: "title",
      direction: "asc",
      playsMin: 2,
      tag: ["solo", "co-op"],
      page: 3,
      pageSize: 24,
    });
  });

  it("serializes a clean collection href", () => {
    expect(collectionHref(new URLSearchParams())).toBe("/collection");
    expect(collectionHref(new URLSearchParams("q=ark&page=2"))).toBe(
      "/collection?q=ark&page=2",
    );
  });
});
