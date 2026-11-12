import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExpansionSelection,
  loadExpansionOptions,
  expansionLabel,
} from "./expansion-selection";
import { apiRequest } from "@/shared/api/client";
vi.mock("@/shared/api/client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe("expansion inputs inside the preorder form", () => {
  it("renders a dropdown without a search form and keeps selection buttons from submitting the preorder", () => {
    const markup = renderToStaticMarkup(
      <form>
        <ExpansionSelection
          prices
          currency="RUB"
          value={[
            {
              key: "first",
              itemId: "expansion-id",
              title: "Дополнение",
              price: "150.25",
            },
          ]}
          onChange={() => {}}
        />
      </form>,
    );
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup).toContain("<select");
    expect(markup).not.toContain("Поиск дополнений");
    expect(markup).toContain('type="number"');
    expect(markup).toContain('value="150.25"');
    expect(markup).toMatch(/id="price-first"[^>]*required/);
    const buttons = markup.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.includes('type="button"'))).toBe(
      true,
    );
  });
});

describe("expansion dropdown options", () => {
  it("loads game-specific options from the expansion API", async () => {
    const result = {
      data: [
        {
          id: "boardgamegeek:123",
          title: "Дополнение",
          external: { provider: "boardgamegeek", externalId: "123" },
        },
      ],
    };
    vi.mocked(apiRequest).mockResolvedValueOnce(result);
    expect(await loadExpansionOptions("known-game")).toEqual(result);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/api/items/known-game/expansions");
  });
  it("loads by provider ID before the base game is imported", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: [] });
    await loadExpansionOptions(undefined, {
      provider: "boardgamegeek",
      externalId: "13",
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/external/expansions?provider=boardgamegeek&externalId=13",
    );
  });
  it("does not show unrelated catalogue entries when no external identifier is known", async () => {
    expect((await loadExpansionOptions()).warnings?.length).toBeGreaterThan(0);
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("reports a loading failure rather than presenting an empty list as a successful result", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Network failure"));
    await expect(loadExpansionOptions("known-game")).rejects.toThrow(
      "Network failure",
    );
  });
});

describe("expansion names and publication dates", () => {
  it("shows both names and the available publication year", () => {
    expect(
      expansionLabel({
        title: "Expansion",
        russianTitle: "Дополнение",
        year: 2027,
      }),
    ).toBe("Expansion / Дополнение — год выхода: 2027");
  });
  it("does not duplicate a Russian primary title or invent a date for missing or zero years", () => {
    expect(
      expansionLabel({
        title: "Дополнение",
        russianTitle: "Дополнение",
        year: 0,
      }),
    ).toBe("Дополнение — дата выхода не указана");
    expect(expansionLabel({ title: "Expansion" })).toBe(
      "Expansion — дата выхода не указана",
    );
  });
});

describe("accessory options", () => {
  it("requests the accessory API list for the known game", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: [] });
    await loadExpansionOptions("known-game", undefined, "accessory");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/items/known-game/expansions?kind=accessory",
    );
  });
});
