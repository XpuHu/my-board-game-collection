import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

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
  createItem,
  updateUserItem,
} from "@/server/application/items/item-service";
import {
  listCollection,
  listCollectionCards,
} from "@/server/application/collection/collection-service";
import { listWishlistCards } from "@/server/application/wishlist/wishlist-service";
import { getDashboard } from "@/server/application/dashboard/dashboard-service";
import {
  createPlaySession,
  deletePlaySession,
  listPlayItems,
  listPlaySessions,
  updatePlaySession,
} from "@/server/application/plays/play-service";
import {
  createPreorder,
  listPreorderItems,
  updatePreorder,
  updatePreorderExpectedDate,
} from "@/server/application/preorders/preorder-service";
import {
  createPurchase,
  deletePurchase,
  listPurchases,
  updatePurchase,
} from "@/server/application/purchases/purchase-service";
import {
  getStatisticsOverview,
  getStatisticsSummary,
} from "@/server/application/statistics/statistics-service";
import {
  exportJsonBackup,
  importJsonBackup,
} from "@/server/application/backup/backup-service";

describe("MVP service flows", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.EXTERNAL_PROVIDERS_ENABLED = "true";
    process.env.BGG_SYNC_ENABLED = "true";
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

  it("updates the full manual UserItem state with tags", async () => {
    const item = await createTestItem({ owned: false, wishlist: true });
    const tag = await prisma.tag.create({
      data: {
        name: "Solo",
      },
    });

    const userItem = await updateUserItem(item.id, {
      owned: true,
      wishlist: true,
      status: "preordered",
      location: "Shelf A",
      personalRating: 9,
      notes: "Keep shrink until campaign",
      interestLevel: 5,
      decisionNotes: "Buy if second printing arrives",
      tagIds: [tag.id],
    });

    expect(userItem).toMatchObject({
      owned: true,
      wishlist: true,
      status: "preordered",
      location: "Shelf A",
      personalRating: 9,
      notes: "Keep shrink until campaign",
      interestLevel: 5,
      decisionNotes: "Buy if second printing arrives",
    });
    expect(userItem.tags).toEqual([
      expect.objectContaining({
        name: "Solo",
      }),
    ]);
    await expect(prisma.userItem.count()).resolves.toBe(1);
  });

  it("creates a manual item with reference lists, image URL and link URL", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });

    const details = await createItem({
      typeId: type.id,
      title: "Manual Game",
      originalTitle: "Manual Original",
      description: "Local card",
      year: 2026,
      minPlayers: 1,
      maxPlayers: 4,
      minPlayTime: 30,
      maxPlayTime: 90,
      minAge: 10,
      complexity: 2.5,
      rating: 8.1,
      sourceMode: "manual",
      categories: ["Strategy"],
      mechanics: ["Drafting"],
      designers: ["Designer One"],
      artists: ["Artist One"],
      publishers: ["Publisher One"],
      imageUrl: "https://example.com/game.jpg",
      linkUrl: "https://example.com/game",
    });

    expect(details.item).toMatchObject({
      title: "Manual Game",
      sourceMode: "manual",
      designers: ["Designer One"],
      artists: ["Artist One"],
      publishers: ["Publisher One"],
    });
    expect(details.images[0]).toMatchObject({
      type: "user",
      provider: "manual",
      url: "https://example.com/game.jpg",
    });
    expect(details.links[0]).toMatchObject({
      type: "other",
      url: "https://example.com/game",
    });
  });

  it("returns a disabled warning without calling external providers", async () => {
    process.env.EXTERNAL_PROVIDERS_ENABLED = "false";
    const bggSearch = vi.spyOn(boardGameGeekProvider, "searchItems");
    const teseraSearch = vi.spyOn(teseraProvider, "searchItems");

    const response = await searchExternalItems({
      q: "Ark Nova",
      provider: "boardgamegeek",
    });

    expect(response.data).toEqual([]);
    expect(response.warnings).toEqual([
      expect.objectContaining({
        provider: "boardgamegeek",
        code: "PROVIDER_DISABLED",
      }),
    ]);
    expect(bggSearch).not.toHaveBeenCalled();
    expect(teseraSearch).not.toHaveBeenCalled();
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

  it("removes duplicate provider results with the same external ID", async () => {
    vi.spyOn(boardGameGeekProvider, "searchItems").mockResolvedValue([
      {
        provider: "boardgamegeek",
        externalId: "342501",
        title: "Games Afoot",
        itemTypeCode: "base_game",
        year: 2022,
      },
      {
        provider: "boardgamegeek",
        externalId: "342501",
        title: "Games Afoot",
        itemTypeCode: "base_game",
        year: 2022,
      },
    ]);

    const response = await searchExternalItems({
      q: "Games Afoot",
      provider: "boardgamegeek",
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      provider: "boardgamegeek",
      externalId: "342501",
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

  it("manages manual play sessions and collection aggregates locally", async () => {
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
    expect(play.source).toBe("manual");

    const manualPlays = await listPlaySessions(
      { source: "manual" },
      { page: 1, pageSize: 10 },
    );
    const bggPlays = await listPlaySessions(
      { source: "boardgamegeek" },
      { page: 1, pageSize: 10 },
    );
    const collection = await listCollection({}, { page: 1, pageSize: 10 });

    expect(manualPlays.pagination.total).toBe(1);
    expect(bggPlays.pagination.total).toBe(0);
    expect(collection.data[0]).toMatchObject({
      playsCount: 1,
      lastPlayedAt: playedAt,
    });

    const updated = await updatePlaySession(play.id, {
      playedAt: "2026-07-07T12:00:00.000Z",
      playersCount: 3,
      durationMinutes: 105,
      result: "score",
      score: "81",
      playerNames: ["Anna", "Max", "Nina"],
      usedItemIds: [],
      notes: "Second run",
    });

    expect(updated.playersCount).toBe(3);
    expect(updated.result).toBe("score");
    expect(updated.locallyModifiedAt).not.toBeNull();

    await deletePlaySession(play.id);
    await expect(prisma.playSession.count()).resolves.toBe(0);
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

  it("fails BGG sync with PROVIDER_DISABLED before calling the provider", async () => {
    process.env.BGG_SYNC_ENABLED = "false";
    const playProvider = vi.spyOn(boardGameGeekPlayProvider, "getUserPlays");

    await expect(syncBggPlays({ username: "tester" })).rejects.toMatchObject({
      code: "PROVIDER_DISABLED",
    });
    expect(playProvider).not.toHaveBeenCalled();
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
      oldValue: JSON.stringify({
        expectedDate: "2026-08-01T00:00:00.000Z",
        expectedDatePrecision: "day",
      }),
      newValue: JSON.stringify({
        expectedDate: "2026-09-15T00:00:00.000Z",
        expectedDatePrecision: "day",
      }),
      reason: "Publisher delay",
      comment: "Wave moved",
    });
    await expect(prisma.preorderEvent.count()).resolves.toBe(1);
  });

  it("marks a preorder as received and moves the item into collection", async () => {
    const item = await createTestItem({ wishlist: true });
    const preorder = await createPreorder(item.id, {
      shop: "Gamefound",
      price: 80,
      currency: "USD",
      orderDate: "2026-06-01T00:00:00.000Z",
      expectedDate: "2026-08-01T00:00:00.000Z",
      status: "ordered",
      comment: "Late pledge",
    });

    const received = await updatePreorder(preorder.id, {
      status: "received",
      receivedDate: "2026-08-20T00:00:00.000Z",
    });
    const userItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });

    expect(received.status).toBe("received");
    expect(received.receivedDate).toBe("2026-08-20T00:00:00.000Z");
    expect(received.events).toEqual([
      expect.objectContaining({
        type: "status_changed",
        oldValue: "ordered",
        newValue: "received",
      }),
    ]);
    expect(userItem.owned).toBe(true);
    expect(userItem.status).toBe("owned");
  });

  it("manages purchases manually and includes them in statistics", async () => {
    const item = await createTestItem({ owned: false, wishlist: true });

    const purchase = await createPurchase(item.id, {
      shop: "Local Store",
      price: 5000,
      currency: "RUB",
      deliveryCost: 500,
      discount: 300,
      purchaseDate: "2026-07-09T00:00:00.000Z",
      comment: "Retail copy",
    });
    const userItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    const statisticsAfterCreate = await getStatisticsSummary();

    expect(purchase.totalPrice).toBe(5200);
    expect(userItem.owned).toBe(true);
    expect(statisticsAfterCreate.collectionValue).toEqual([
      { amount: 5200, currency: "RUB" },
    ]);

    const updated = await updatePurchase(purchase.id, {
      price: 4500,
      deliveryCost: 400,
      discount: 0,
      comment: "Discount corrected",
    });
    const purchases = await listPurchases();
    const statisticsAfterUpdate = await getStatisticsSummary();

    expect(updated.totalPrice).toBe(4900);
    expect(purchases).toHaveLength(1);
    expect(statisticsAfterUpdate.collectionValue).toEqual([
      { amount: 4900, currency: "RUB" },
    ]);

    await deletePurchase(purchase.id);
    const statisticsAfterDelete = await getStatisticsSummary();

    await expect(prisma.purchase.count()).resolves.toBe(0);
    expect(statisticsAfterDelete.collectionValue).toEqual([]);
  });

  it("serves compact paginated read models and dashboard aggregates", async () => {
    const ownedItem = await createTestItem({ title: "Owned", owned: true });
    const usedItem = await createTestItem({ title: "Expansion", owned: true });
    await createTestItem({ title: "Wanted", wishlist: true });

    await createPlaySession(ownedItem.id, {
      playedAt: "2026-07-10T18:00:00.000Z",
      playersCount: 2,
      durationMinutes: 90,
      result: "win",
      playerNames: ["Anna", "Max"],
      usedItemIds: [usedItem.id],
    });
    await createPreorder(ownedItem.id, {
      shop: "Store",
      price: 50,
      currency: "USD",
      expectedDate: "2026-07-20T00:00:00.000Z",
      status: "paid",
    });

    const collection = await listCollectionCards(
      { playsMin: 1, sort: "plays" },
      { page: 1, pageSize: 1 },
    );
    const lastPlayedCollection = await listCollectionCards(
      { sort: "lastPlayed", direction: "desc" },
      { page: 1, pageSize: 1 },
    );
    const wishlist = await listWishlistCards(
      { q: "Want" },
      { page: 1, pageSize: 24 },
    );
    const plays = await listPlayItems(
      {
        playerName: "ann",
        usedItemId: usedItem.id,
        result: "win",
        durationMin: 60,
      },
      { page: 1, pageSize: 20 },
    );
    const preorders = await listPreorderItems(
      { group: "active", expectedTo: "2026-07-31T23:59:59.999Z" },
      { page: 1, pageSize: 20 },
    );
    const dashboard = await getDashboard(new Date("2026-07-15T12:00:00.000Z"));
    const overview = await getStatisticsOverview(
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(collection.pagination).toMatchObject({ total: 1, pageSize: 1 });
    expect(collection.data[0]).toMatchObject({
      item: { title: "Owned" },
      plays: { count: 1 },
      activePreorder: { uiStatus: "active" },
    });
    expect(lastPlayedCollection.data[0].item.title).toBe("Owned");
    expect(wishlist.data[0].item.title).toBe("Wanted");
    expect(plays.data[0]).toMatchObject({
      item: { title: "Owned" },
      playerNames: ["Anna", "Max"],
    });
    expect(preorders.data[0]).toMatchObject({
      item: { title: "Owned" },
      uiStatus: "active",
    });
    expect(dashboard).toMatchObject({
      monthSummary: {
        playsCount: 1,
        uniqueItemsCount: 1,
        totalDurationMinutes: 90,
        winsCount: 1,
      },
    });
    expect(dashboard.recentPlays).toHaveLength(1);
    expect(dashboard.upcomingPreorders).toHaveLength(1);
    expect(overview).toMatchObject({
      uniquePlayedItems: 1,
      totalPlayHours: 1.5,
      winRate: 100,
    });
    expect(overview.frequentPlayers[0]).toEqual({
      name: "Anna",
      playsCount: 1,
    });
    expect(overview.expansionUsage[0]).toEqual({
      itemId: usedItem.id,
      title: "Expansion",
      playsCount: 1,
    });
  });

  it("exports and imports the full manual dataset without duplicate records", async () => {
    const base = await createTestItem({
      title: "Backup Base Game",
      owned: true,
      wishlist: true,
    });
    const expansion = await createTestItem({
      title: "Backup Expansion",
      owned: true,
    });
    const tag = await prisma.tag.create({
      data: {
        name: "Backup Tag",
      },
    });

    await prisma.item.update({
      where: { id: base.id },
      data: {
        categories: ["Strategy"],
        mechanics: ["Deck building"],
        designers: ["Designer"],
        artists: ["Artist"],
        publishers: ["Publisher"],
        tags: {
          set: [{ id: tag.id }],
        },
      },
    });
    await prisma.externalReference.create({
      data: {
        itemId: base.id,
        provider: "boardgamegeek",
        externalId: "backup-1",
        url: "https://boardgamegeek.com/boardgame/1/backup",
      },
    });
    await prisma.image.create({
      data: {
        itemId: base.id,
        type: "user",
        provider: "manual",
        url: "https://example.com/backup.jpg",
        caption: "Box",
      },
    });
    await prisma.link.create({
      data: {
        itemId: base.id,
        type: "rules",
        url: "https://example.com/rules.pdf",
        title: "Rules",
      },
    });
    await prisma.note.create({
      data: {
        itemId: base.id,
        title: "Note",
        body: "Manual note",
      },
    });
    await prisma.itemRelation.create({
      data: {
        parentItemId: base.id,
        childItemId: expansion.id,
        relationType: "expansion",
      },
    });
    await createPurchase(base.id, {
      shop: "Backup Shop",
      price: 1000,
      currency: "RUB",
      purchaseDate: "2026-07-09T00:00:00.000Z",
    });
    const preorder = await createPreorder(base.id, {
      shop: "Backup Preorder",
      price: 40,
      currency: "USD",
      expectedDate: "2026-10-01T00:00:00.000Z",
      status: "ordered",
    });
    await updatePreorderExpectedDate(preorder.id, {
      expectedDate: "2026-11-01T00:00:00.000Z",
      reason: "Delay",
    });
    await createPlaySession(base.id, {
      playedAt: "2026-07-01T00:00:00.000Z",
      playersCount: 2,
      usedItemIds: [expansion.id],
    });
    await prisma.playSession.create({
      data: {
        itemId: base.id,
        playedAt: new Date("2026-07-02T00:00:00.000Z"),
        source: "boardgamegeek",
        bggPlayId: "backup-bgg-play",
        playerNames: [],
        usedItemIds: [],
      },
    });

    const backup = await exportJsonBackup();
    const duplicateExternalReference = {
      ...backup.data.externalReferences[0],
      id: randomUUID(),
    };
    const duplicateRelation = {
      ...backup.data.relations[0],
      id: randomUUID(),
    };
    const bggPlay = backup.data.playSessions.find((play) => play.bggPlayId);

    if (!bggPlay) {
      throw new Error("Expected exported BGG play");
    }

    const duplicateBggPlay = {
      ...bggPlay,
      id: randomUUID(),
    };

    backup.data.externalReferences.push(duplicateExternalReference);
    backup.data.relations.push(duplicateRelation);
    backup.data.itemTags.push(backup.data.itemTags[0]);
    backup.data.playSessions.push(duplicateBggPlay);

    await clearDomainData();

    const firstReport = await importJsonBackup(backup);
    const secondReport = await importJsonBackup(backup);
    const importedBase = await prisma.item.findUniqueOrThrow({
      where: { id: base.id },
      include: {
        tags: true,
      },
    });

    expect(firstReport.created).toMatchObject({
      items: 2,
      userItems: 2,
      externalReferences: 1,
      images: 1,
      links: 1,
      purchases: 1,
      preorders: 1,
      preorderEvents: 1,
      playSessions: 2,
      notes: 1,
      relations: 1,
    });
    expect(firstReport.skippedDuplicates).toMatchObject({
      externalReferences: 1,
      bggPlayIds: 1,
      relations: 1,
      itemTags: 1,
    });
    expect(firstReport.skippedMissingReferences).toEqual({
      itemTypes: 0,
      items: 0,
      tags: 0,
      preorders: 0,
    });
    expect(secondReport.updated.items).toBe(2);
    expect(secondReport.skippedDuplicates).toMatchObject({
      externalReferences: 1,
      bggPlayIds: 1,
      relations: 2,
      itemTags: 1,
    });
    await expect(prisma.externalReference.count()).resolves.toBe(1);
    await expect(prisma.itemRelation.count()).resolves.toBe(1);
    await expect(prisma.playSession.count()).resolves.toBe(2);
    expect(importedBase.tags).toHaveLength(1);
    expect(importedBase.categories).toEqual(["Strategy"]);
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
