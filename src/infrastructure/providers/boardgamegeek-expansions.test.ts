import { afterEach, describe, expect, it, vi } from "vitest";
import { boardGameGeekProvider } from "./boardgamegeek-provider";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("BoardGameGeek expansion API", () => {
  it("reads expansion links for the requested game and excludes inbound links, duplicates and other relations", async () => {
    vi.stubEnv("BGG_TOKEN", "token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          `<items><item id="13" type="boardgame"><link type="boardgameexpansion" id="14" value="Expansion &amp; promo"/><link type="boardgameexpansion" id="14" value="Duplicate"/><link type="boardgameexpansion" id="15" value="Base" inbound="true"/><link type="boardgameaccessory" id="16" value="Accessory"/></item><item id="99"><link type="boardgameexpansion" id="100" value="Unrelated"/></item></items>`,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await boardGameGeekProvider.getRelatedItems("13")).toEqual([
      {
        provider: "boardgamegeek",
        externalId: "14",
        title: "Expansion & promo",
        itemTypeCode: "expansion",
        url: "https://boardgamegeek.com/boardgameexpansion/14",
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://boardgamegeek.com/xmlapi2/thing?id=13",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer token");
  });
  it("does not treat a queued or unauthorized response as an empty catalogue", async () => {
    for (const status of [202, 401]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("<message>Unavailable</message>", { status }),
          ),
      );
      await expect(
        boardGameGeekProvider.getRelatedItems("13"),
      ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    }
  });
  it("distinguishes an absent game from a game with no expansions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response('<items><item id="13"></item></items>'),
        )
        .mockResolvedValueOnce(new Response("<items></items>")),
    );
    expect(await boardGameGeekProvider.getRelatedItems("13")).toEqual([]);
    await expect(
      boardGameGeekProvider.getRelatedItems("13"),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });
  it("loads Russian alternate titles and publication years from expansion details", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          '<items><item id="13"><link type="boardgameexpansion" id="14" value="Expansion"/><link type="boardgameexpansion" id="15" value="Unknown"/></item></items>',
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          '<items><item id="14" type="boardgameexpansion"><name type="primary" value="Expansion"/><name type="alternate" value="Українське доповнення"/><name type="alternate" value="Русское дополнение &amp; промо"/><yearpublished value="2027"/></item><item id="15" type="boardgameexpansion"><name type="primary" value="Unknown"/><yearpublished value="0"/></item></items>',
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const results = await boardGameGeekProvider.getRelatedItems("13");
    expect(results[0]).toMatchObject({
      title: "Expansion",
      russianTitle: "Русское дополнение & промо",
      year: 2027,
    });
    expect(results[1].russianTitle).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://boardgamegeek.com/xmlapi2/thing?id=14,15",
    );
  });
  it("loads metadata in batches of at most twenty expansions", async () => {
    const links = Array.from(
      { length: 21 },
      (_, i) =>
        `<link type="boardgameexpansion" id="${100 + i}" value="Expansion ${i}"/>`,
    ).join("");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(`<items><item id="13">${links}</item></items>`),
      )
      .mockImplementation(async () => new Response("<items></items>"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await boardGameGeekProvider.getRelatedItems("13")).toHaveLength(21);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      new URL(fetchMock.mock.calls[1][0]).searchParams.get("id")?.split(","),
    ).toHaveLength(20);
    expect(new URL(fetchMock.mock.calls[2][0]).searchParams.get("id")).toBe(
      "120",
    );
  });
  it("keeps expansions selectable if optional metadata cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            '<items><item id="13"><link type="boardgameexpansion" id="14" value="Expansion"/></item></items>',
          ),
        )
        .mockRejectedValueOnce(new Error("Offline")),
    );
    expect(await boardGameGeekProvider.getRelatedItems("13")).toMatchObject([
      { title: "Expansion", externalId: "14" },
    ]);
  });
  it("loads accessory links separately from expansions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            '<items><item id="13"><link type="boardgameexpansion" id="14" value="Expansion"/><link type="boardgameaccessory" id="15" value="Accessory"/></item></items>',
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            '<items><item id="15" type="boardgameaccessory"><name type="primary" value="Accessory"/><yearpublished value="2027"/></item></items>',
          ),
        ),
    );
    expect(
      await boardGameGeekProvider.getRelatedItems("13", "accessory"),
    ).toMatchObject([
      { externalId: "15", itemTypeCode: "accessory", year: 2027 },
    ]);
  });
});
