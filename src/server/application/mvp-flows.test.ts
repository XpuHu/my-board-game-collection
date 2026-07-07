import { beforeEach, describe, expect, it, vi } from "vitest";

import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { boardGameGeekPlayProvider } from "@/infrastructure/providers/bgg-play-provider";
import { teseraProvider } from "@/infrastructure/providers/tesera-provider";
import { prisma } from "@/infrastructure/database/prisma";
import { syncBggPlays } from "@/server/application/bgg-sync/bgg-sync-service";
import {
  importExternalItem,
  searchExternalItems,
} from "@/server/application/search/external-search-service";
import {
  addItemToCollection,
  addItemToWishlist,
} from "@/server/application/items/item-service";
import { createPlaySession } from "@/server/application/plays/play-service";
import {
  createPreorder,
  updatePreorderExpectedDate,
} from "@/server/application/preorders/preorder-service";

describe("MVP service flows", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearDomainData();
  });

  it("adds an item to collection without duplicating Item or UserItem", async () => {
    const item = await createTestItem({ wishlist: true });

    await addItemToCollection(item.id, {
      location: "Shelf A",
      personalRating: 9,
      notes: "Core box",
    });
    await addItemToCollection(item.id, {
      location: "Shelf B",
      personalRating: 8,
      notes: "Moved",
    });

    await expect(prisma.item.count()).resolves.toBe(1);
    await expect(prisma.userItem.count()).resolves.toBe(1);
    await expect(prisma.purchase.count()).resolves.toBe(0);

    const userItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });

    expect(userItem.owned).toBe(true);
    expect(userItem.wishlist).toBe(true);
    expect(userItem.status).toBe("owned");
    expect(userItem.location).toBe("Shelf B");
  });

  it("adds an item to wishlist without duplicating UserItem", async () => {
    const item = await createTestItem({ owned: false, wishlist: false });

    await addItemToWishlist(item.id);
    await addItemToWishlist(item.id);

    await expect(prisma.item.count()).resolves.toBe(1);
    await expect(prisma.userItem.count()).resolves.toBe(1);

    const userItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });

    expect(userItem.owned).toBe(false);
    expect(userItem.wishlist).toBe(true);
    expect(userItem.status).toBe("wishlist");
  });

  it("falls back to Tesera when BGG search fails", async () => {
    vi.spyOn(boardGameGeekProvider, "searchItems").mockRejectedValue(
      new Error("BGG is unavailable"),
    );
    vi.spyOn(teseraProvider, "searchItems").mockResolvedValue([
      {
        provider: "tesera",
        externalId: "ark-nova",
        title: "Ark Nova",
        originalTitle: "Ark Nova",
        itemTypeCode: "base_game",
        year: 2021,
        url: "https://tesera.ru/game/ark-nova/",
      },
    ]);

    const response = await searchExternalItems({
      q: "Ark Nova",
      provider: "boardgamegeek",
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      provider: "tesera",
      externalId: "ark-nova",
      title: "Ark Nova",
    });
    expect(response.warnings?.[0]).toMatchObject({
      provider: "boardgamegeek",
      code: "PROVIDER_FALLBACK",
    });
  });

  it("falls back to Tesera when BGG returns no search results", async () => {
    vi.spyOn(boardGameGeekProvider, "searchItems").mockResolvedValue([]);
    vi.spyOn(teseraProvider, "searchItems").mockResolvedValue([
      {
        provider: "tesera",
        externalId: "paleo",
        title: "Палео",
        originalTitle: "Paleo",
        itemTypeCode: "base_game",
        year: 2020,
        url: "https://tesera.ru/game/paleo/",
      },
    ]);

    const response = await searchExternalItems({
      q: "палео",
      provider: "boardgamegeek",
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      provider: "tesera",
      externalId: "paleo",
      title: "Палео",
    });
    expect(response.warnings?.[0]).toMatchObject({
      provider: "boardgamegeek",
      code: "PROVIDER_EMPTY_FALLBACK",
    });
  });

  it("returns warnings instead of failing when all external search providers fail", async () => {
    vi.spyOn(boardGameGeekProvider, "searchItems").mockRejectedValue(
      new Error("BGG is unavailable"),
    );
    vi.spyOn(teseraProvider, "searchItems").mockRejectedValue(
      new Error("Tesera request failed"),
    );

    const response = await searchExternalItems({
      q: "палео",
      provider: "boardgamegeek",
    });

    expect(response.data).toEqual([]);
    expect(response.warnings).toEqual([
      expect.objectContaining({
        provider: "boardgamegeek",
        code: "PROVIDER_FALLBACK",
      }),
      expect.objectContaining({
        provider: "tesera",
        code: "PROVIDER_FALLBACK_FAILED",
      }),
    ]);
  });

  it("imports a Tesera item into the collection", async () => {
    vi.spyOn(teseraProvider, "getItem").mockResolvedValue({
      provider: "tesera",
      externalId: "tesera-game",
      title: "Тесера игра",
      originalTitle: "Tesera Game",
      itemTypeCode: "base_game",
      description: "Русскоязычная карточка",
      year: 2024,
      minPlayers: 1,
      maxPlayers: 4,
      minPlayTime: 30,
      maxPlayTime: 60,
      minAge: 10,
      complexity: 2.5,
      rating: 8.1,
      categories: ["Карточная"],
      mechanics: ["Драфт"],
      designers: ["Автор"],
      artists: [],
      publishers: ["Издатель"],
      imageUrl: "https://tesera.ru/images/game.jpg",
      url: "https://tesera.ru/game/tesera-game/",
    });

    const details = await importExternalItem({
      provider: "tesera",
      externalId: "tesera-game",
      target: "collection",
    });

    expect(details.item.title).toBe("Тесера игра");
    expect(details.userItem.owned).toBe(true);
    expect(details.externalReferences[0]).toMatchObject({
      provider: "tesera",
      externalId: "tesera-game",
    });
    expect(details.images[0]).toMatchObject({
      provider: "tesera",
      caption: "Tesera",
    });
    expect(details.links[0]).toMatchObject({
      title: "Tesera",
    });
  });

  it("creates a play session linked to the selected Item", async () => {
    const item = await createTestItem({ title: "Spirit Island", owned: true });
    const playedAt = "2026-07-06T12:00:00.000Z";

    const play = await createPlaySession(item.id, {
      playedAt,
      playersCount: 2,
      durationMinutes: 95,
      result: "win",
      score: "74",
      scenario: "Difficulty 4",
      playerNames: ["Anna", "Max"],
      usedItemIds: [],
      notes: "Fast win",
    });

    expect(play.itemId).toBe(item.id);
    expect(play.itemTitle).toBe("Spirit Island");
    expect(play.playedAt).toBe(playedAt);
    expect(play.playersCount).toBe(2);
    expect(play.result).toBe("win");
    await expect(prisma.playSession.count()).resolves.toBe(1);
  });

  it("syncs BGG plays idempotently by bggPlayId", async () => {
    const item = await createTestItem({ owned: true });
    await prisma.externalReference.create({
      data: {
        itemId: item.id,
        provider: "boardgamegeek",
        externalId: "12345",
      },
    });

    vi.spyOn(boardGameGeekPlayProvider, "getUserPlays").mockResolvedValue([
      normalizedBggPlay({ bggPlayId: "9001" }),
      normalizedBggPlay({ bggPlayId: "9001" }),
    ]);

    const firstReport = await syncBggPlays({ username: "tester" });
    const secondReport = await syncBggPlays({ username: "tester" });

    expect(firstReport.imported).toBe(1);
    expect(firstReport.skippedDuplicates).toBe(1);
    expect(secondReport.imported).toBe(0);
    expect(secondReport.skippedDuplicates).toBe(2);
    await expect(prisma.playSession.count()).resolves.toBe(1);
  });

  it("creates a PreorderEvent when expected date changes", async () => {
    const item = await createTestItem({ wishlist: true });
    const preorder = await createPreorder(item.id, {
      shop: "Gamefound",
      price: 120,
      currency: "USD",
      orderDate: "2026-06-01T00:00:00.000Z",
      expectedDate: "2026-08-01T00:00:00.000Z",
      status: "ordered",
      comment: "Campaign pledge",
    });

    const updated = await updatePreorderExpectedDate(preorder.id, {
      expectedDate: "2026-09-15T00:00:00.000Z",
      reason: "Publisher delay",
      comment: "Wave moved",
    });

    expect(updated.expectedDate).toBe("2026-09-15T00:00:00.000Z");
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0]).toMatchObject({
      type: "expected_date_changed",
      oldValue: "2026-08-01T00:00:00.000Z",
      newValue: "2026-09-15T00:00:00.000Z",
      reason: "Publisher delay",
      comment: "Wave moved",
    });
    await expect(prisma.preorderEvent.count()).resolves.toBe(1);
  });
});

async function createTestItem({
  title = "Test Game",
  owned = false,
  wishlist = false,
}: {
  title?: string;
  owned?: boolean;
  wishlist?: boolean;
}) {
  const type = await prisma.itemType.findUniqueOrThrow({
    where: { code: "base_game" },
  });

  return prisma.item.create({
    data: {
      typeId: type.id,
      title,
      sourceMode: "manual",
      categories: [],
      mechanics: [],
      designers: [],
      artists: [],
      publishers: [],
      userItem: {
        create: {
          owned,
          wishlist,
          status: owned ? "owned" : "wishlist",
        },
      },
    },
  });
}

function normalizedBggPlay({ bggPlayId }: { bggPlayId: string }) {
  return {
    bggPlayId,
    bggThingId: "12345",
    title: "Test Game",
    playedAt: new Date("2026-07-01T00:00:00.000Z"),
    playersCount: 2,
    durationMinutes: 60,
    result: "unknown" as const,
    score: null,
    playerNames: ["Anna", "Max"],
    notes: null,
    quantity: 1,
  };
}

async function clearDomainData() {
  await prisma.preorderEvent.deleteMany();
  await prisma.preorder.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.playSession.deleteMany();
  await prisma.externalReference.deleteMany();
  await prisma.image.deleteMany();
  await prisma.link.deleteMany();
  await prisma.note.deleteMany();
  await prisma.itemRelation.deleteMany();
  await prisma.userItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.tag.deleteMany();
}
