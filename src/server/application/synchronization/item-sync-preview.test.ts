import { describe, expect, it } from "vitest";

import { syncItemRequestSchema } from "@/shared/api";
import type { ProviderItem } from "@/infrastructure/providers/item-provider";

import { buildChanges } from "./item-sync-service";

const before: Parameters<typeof buildChanges>[0] = {
  title: "Локальное название",
  originalTitle: null,
  description: null,
  year: 2020,
  minPlayers: 1,
  maxPlayers: 4,
  minPlayTime: 60,
  maxPlayTime: 120,
  minAge: 12,
  complexity: 3.5,
  rating: 8,
  categories: ["Стратегия"],
  mechanics: [],
  designers: [],
  artists: [],
  publishers: [],
  type: {
    code: "base_game",
  },
};

const incoming: ProviderItem = {
  provider: "boardgamegeek",
  externalId: "42",
  title: "Provider title",
  originalTitle: null,
  itemTypeCode: "base_game",
  description: "Описание из источника",
  year: 2020,
  minPlayers: 1,
  maxPlayers: 4,
  minPlayTime: 60,
  maxPlayTime: 120,
  minAge: 12,
  complexity: 3.5,
  rating: 8,
  categories: ["Стратегия"],
  mechanics: ["Контроль территорий"],
  designers: [],
  artists: [],
  publishers: [],
  imageUrl: "https://example.com/cover.jpg",
  url: "https://example.com/game/42",
};

describe("item reference synchronization preview", () => {
  it("returns only differences and protects populated local values by default", () => {
    const changes = buildChanges(
      before,
      incoming,
      true,
      "https://old.example/game/42",
    );

    expect(changes.map(({ field }) => field)).toEqual([
      "title",
      "description",
      "mechanics",
      "externalReferences",
      "images",
      "links",
    ]);
    expect(changes.find(({ field }) => field === "title")).toMatchObject({
      currentValue: "Локальное название",
      incomingValue: "Provider title",
      selectedByDefault: false,
    });
    expect(changes.find(({ field }) => field === "description")).toMatchObject({
      currentValue: null,
      incomingValue: "Описание из источника",
      selectedByDefault: true,
    });
  });

  it("accepts preview and selective apply requests but does not mix both", () => {
    expect(
      syncItemRequestSchema.parse({
        provider: "boardgamegeek",
        preview: true,
      }),
    ).toEqual({ provider: "boardgamegeek", preview: true });

    expect(
      syncItemRequestSchema.parse({
        provider: "boardgamegeek",
        fields: ["description", "images"],
      }),
    ).toEqual({
      provider: "boardgamegeek",
      fields: ["description", "images"],
    });

    expect(() =>
      syncItemRequestSchema.parse({
        preview: true,
        fields: ["title"],
      }),
    ).toThrow();
  });
});
