import { afterEach, describe, expect, it, vi } from "vitest";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { teseraProvider } from "@/infrastructure/providers/tesera-provider";
import { GET } from "@/app/api/external/search/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("preorder BGG search", () => {
  it("returns an empty result without querying Tesera when fallback is disabled", async () => {
    vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
    const bgg = vi
      .spyOn(boardGameGeekProvider, "searchItems")
      .mockResolvedValue([]);
    const tesera = vi
      .spyOn(teseraProvider, "searchItems")
      .mockResolvedValue([]);
    const response = await GET(
      new Request(
        "http://localhost/api/external/search?q=Dune&provider=boardgamegeek&fallback=false",
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
    expect(bgg).toHaveBeenCalledWith("Dune", { type: undefined });
    expect(tesera).not.toHaveBeenCalled();
  });

  it("reports a BGG failure without silently searching another catalogue", async () => {
    vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
    vi.spyOn(boardGameGeekProvider, "searchItems").mockRejectedValue(
      new Error("BGG offline"),
    );
    const tesera = vi
      .spyOn(teseraProvider, "searchItems")
      .mockResolvedValue([]);
    const response = await GET(
      new Request(
        "http://localhost/api/external/search?q=Dune&provider=boardgamegeek&fallback=false",
      ),
    );
    expect(response.ok).toBe(false);
    expect(tesera).not.toHaveBeenCalled();
  });
});
