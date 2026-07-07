import { beforeEach, describe, expect, it, vi } from "vitest";

import { boardGameGeekPlayProvider } from "@/infrastructure/providers/bgg-play-provider";
import { prisma } from "@/infrastructure/database/prisma";
import { POST as addToCollectionRoute } from "@/app/api/items/[itemId]/collection/route";
import { POST as addToWishlistRoute } from "@/app/api/items/[itemId]/wishlist/route";
import { POST as createPlayRoute } from "@/app/api/items/[itemId]/plays/route";
import { PATCH as updateExpectedDateRoute } from "@/app/api/preorders/[preorderId]/expected-date/route";
import { POST as syncBggPlaysRoute } from "@/app/api/sync/bgg/plays/route";

describe("MVP API flows", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearDomainData();
  });

  it("adds a play through the route handler", async () => {
    const item = await createTestItem({ owned: true });

    const response = await createPlayRoute(
      jsonRequest({
        playedAt: "2026-07-01T00:00:00.000Z",
        playersCount: 2,
        durationMinutes: 80,
        result: "win",
        playerNames: ["Anna", "Max"],
      }),
      itemContext(item.id),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.itemId).toBe(item.id);
    expect(body.playersCount).toBe(2);
    await expect(prisma.playSession.count()).resolves.toBe(1);
  });

  it("changes preorder expected date through the route handler", async () => {
    const item = await createTestItem({ wishlist: true });
    const preorder = await prisma.preorder.create({
      data: {
        itemId: item.id,
        shop: "CrowdRepublic",
        price: 9990,
        currency: "RUB",
        expectedDate: new Date("2026-08-01T00:00:00.000Z"),
        status: "ordered",
      },
    });

    const response = await updateExpectedDateRoute(
      jsonRequest({
        expectedDate: "2026-10-01T00:00:00.000Z",
        reason: "Доставка",
        comment: "Новая волна",
      }),
      preorderContext(preorder.id),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.expectedDate).toBe("2026-10-01T00:00:00.000Z");
    expect(body.events).toHaveLength(1);
    await expect(prisma.preorderEvent.count()).resolves.toBe(1);
  });

  it("adds an item to collection and wishlist through route handlers", async () => {
    const item = await createTestItem({ owned: false, wishlist: false });

    const collectionResponse = await addToCollectionRoute(
      jsonRequest({
        location: "Shelf A",
        personalRating: 10,
      }),
      itemContext(item.id),
    );
    const wishlistResponse = await addToWishlistRoute(
      jsonRequest({}),
      itemContext(item.id),
    );

    expect(collectionResponse.status).toBe(200);
    expect(wishlistResponse.status).toBe(200);
    await expect(prisma.item.count()).resolves.toBe(1);
    await expect(prisma.userItem.count()).resolves.toBe(1);

    const userItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    expect(userItem.owned).toBe(true);
    expect(userItem.wishlist).toBe(true);
  });

  it("syncs BGG plays through the route handler with a mocked provider", async () => {
    const item = await createTestItem({ owned: true });
    await prisma.externalReference.create({
      data: {
        itemId: item.id,
        provider: "boardgamegeek",
        externalId: "777",
      },
    });
    vi.spyOn(boardGameGeekPlayProvider, "getUserPlays").mockResolvedValue([
      {
        bggPlayId: "bgg-1",
        bggThingId: "777",
        title: item.title,
        playedAt: new Date("2026-07-01T00:00:00.000Z"),
        playersCount: 3,
        durationMinutes: 120,
        result: "unknown",
        score: null,
        playerNames: [],
        notes: null,
        quantity: 1,
      },
    ]);

    const firstResponse = await syncBggPlaysRoute(
      jsonRequest({ username: "tester" }),
    );
    const secondResponse = await syncBggPlaysRoute(
      jsonRequest({ username: "tester" }),
    );
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody.imported).toBe(1);
    expect(secondBody.imported).toBe(0);
    expect(secondBody.skippedDuplicates).toBe(1);
    await expect(prisma.playSession.count()).resolves.toBe(1);
  });
});

async function createTestItem({
  title = "Route Test Game",
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

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function itemContext(itemId: string) {
  return {
    params: Promise.resolve({ itemId }),
  };
}

function preorderContext(preorderId: string) {
  return {
    params: Promise.resolve({ preorderId }),
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
