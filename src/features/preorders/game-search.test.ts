import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPreorderGames } from "./game-search";

afterEach(() => vi.unstubAllGlobals());

const local = {
  data: [{ id: "game", title: "Dune", type: { name: "Игра" } }],
  pagination: { page: 1, totalPages: 1, total: 1 },
};
const empty = { data: [], pagination: { page: 1, totalPages: 0, total: 0 } };
const external = {
  data: [{ provider: "boardgamegeek", externalId: "123", title: "Dune" }],
};

describe("preorder game search", () => {
  it("uses matching saved games before contacting BGG", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(local));
    vi.stubGlobal("fetch", fetch);
    expect(await searchPreorderGames(" Dune ")).toEqual({
      source: "local",
      ...local,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/items/search?q=Dune&page=1");
  });

  it("searches BGG automatically only after the database gives no matches", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(empty))
      .mockResolvedValueOnce(Response.json(external));
    vi.stubGlobal("fetch", fetch);
    expect(await searchPreorderGames("Dune")).toEqual({
      source: "external",
      ...external,
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/items/search?q=Dune&page=1",
      "/api/external/search?q=Dune&provider=boardgamegeek&fallback=false",
    ]);
  });

  it("offers manual entry only after both searches return no matches", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(empty))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetch);
    expect(await searchPreorderGames("Unknown")).toEqual({
      source: "external",
      data: [],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("can continue the same search in BGG when local matches are unsuitable", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(external));
    vi.stubGlobal("fetch", fetch);
    expect((await searchPreorderGames("Dune", 1, true)).source).toBe(
      "external",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("/api/external/search?");
  });

  it("does not treat a failed or disabled search as an empty result", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    vi.stubGlobal("fetch", fetch);
    await expect(searchPreorderGames("Dune")).rejects.toThrow("Network error");
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch
      .mockResolvedValueOnce(Response.json(empty))
      .mockResolvedValueOnce(
        Response.json({ data: [], warnings: [{ code: "PROVIDER_DISABLED" }] }),
      );
    await expect(searchPreorderGames("Dune")).rejects.toThrow("BGG отключён");
  });

  it("preserves local pagination without switching to the external catalogue", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          ...local,
          pagination: { page: 2, totalPages: 2, total: 25 },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await searchPreorderGames("Dune", 2);
    expect(result.source).toBe("local");
    expect(fetch.mock.calls[0][0]).toBe("/api/items/search?q=Dune&page=2");
  });
});
