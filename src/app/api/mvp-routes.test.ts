import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { boardGameGeekPlayProvider } from "@/infrastructure/providers/bgg-play-provider";
import { prisma } from "@/infrastructure/database/prisma";
import { POST as createItemRoute } from "@/app/api/items/route";
import { POST as addToCollectionRoute } from "@/app/api/items/[itemId]/collection/route";
import { PATCH as updateItemRoute } from "@/app/api/items/[itemId]/route";
import { POST as createReferenceRoute } from "@/app/api/items/[itemId]/external-references/route";
import {
  DELETE as deleteReferenceRoute,
  PATCH as updateReferenceRoute,
} from "@/app/api/items/[itemId]/external-references/[referenceId]/route";
import { POST as createImageRoute } from "@/app/api/items/[itemId]/images/route";
import {
  DELETE as deleteImageRoute,
  PATCH as updateImageRoute,
} from "@/app/api/items/[itemId]/images/[imageId]/route";
import { POST as createLinkRoute } from "@/app/api/items/[itemId]/links/route";
import {
  DELETE as deleteLinkRoute,
  PATCH as updateLinkRoute,
} from "@/app/api/items/[itemId]/links/[linkId]/route";
import { POST as addToWishlistRoute } from "@/app/api/items/[itemId]/wishlist/route";
import { POST as createPlayRoute } from "@/app/api/items/[itemId]/plays/route";
import { PATCH as updateExpectedDateRoute } from "@/app/api/preorders/[preorderId]/expected-date/route";
import { POST as syncBggPlaysRoute } from "@/app/api/sync/bgg/plays/route";
import { POST as importJsonRoute } from "@/app/api/import/json/route";

describe("MVP API flows", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.EXTERNAL_PROVIDERS_ENABLED = "true";
    process.env.BGG_SYNC_ENABLED = "true";
    delete process.env.BGG_TOKEN;
    delete process.env.BGG_APPLICATION_TOKEN;
    await clearDomainData();
  });

  it("creates a manual item through the route handler", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });

    const response = await createItemRoute(
      jsonRequest({
        typeId: type.id,
        title: "Manual Route Game",
        originalTitle: "Manual Original",
        description: "Created without external providers",
        year: 2026,
        minPlayers: 1,
        maxPlayers: 4,
        minPlayTime: 30,
        maxPlayTime: 90,
        minAge: 10,
        complexity: 2.4,
        rating: 8.1,
        sourceMode: "manual",
        categories: ["Strategy"],
        mechanics: ["Drafting"],
        designers: ["Designer One"],
        artists: ["Artist One"],
        publishers: ["Publisher One"],
        imageUrl: "https://example.com/manual-route.jpg",
        linkUrl: "https://example.com/manual-route",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.item).toMatchObject({
      title: "Manual Route Game",
      sourceMode: "manual",
      categories: ["Strategy"],
      mechanics: ["Drafting"],
    });
    expect(body.images[0]).toMatchObject({
      provider: "manual",
      url: "https://example.com/manual-route.jpg",
    });
    expect(body.links[0]).toMatchObject({
      url: "https://example.com/manual-route",
    });
    await expect(prisma.item.count()).resolves.toBe(1);
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
    expect(body.preorder.expectedDate).toBe("2026-10-01T00:00:00.000Z");
    expect(body.event).toMatchObject({
      type: "expected_date_changed",
      legacyFormat: false,
    });
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

  it("updates item reference fields without changing the user item", async () => {
    const item = await createTestItem({ owned: true });
    const beforeUserItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });

    const response = await updateItemRoute(
      jsonRequest({
        title: "Updated Reference Game",
        year: 2026,
        description: "Manual description",
        minPlayers: 1,
        maxPlayers: 4,
        minPlayTime: 45,
        maxPlayTime: 90,
        rating: 8.4,
        categories: ["Strategy", "Solo"],
        mechanics: ["Deck building"],
        designers: ["Designer One"],
        artists: ["Artist One"],
        publishers: ["Publisher One"],
      }),
      itemContext(item.id),
    );
    const body = await response.json();
    const afterUserItem = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: item.id },
    });

    expect(response.status).toBe(200);
    expect(body.item.title).toBe("Updated Reference Game");
    expect(body.item.categories).toEqual(["Strategy", "Solo"]);
    expect(body.item.mechanics).toEqual(["Deck building"]);
    expect(afterUserItem.owned).toBe(beforeUserItem.owned);
    expect(afterUserItem.wishlist).toBe(beforeUserItem.wishlist);
    expect(afterUserItem.location).toBe(beforeUserItem.location);
    expect(afterUserItem.personalRating).toBe(beforeUserItem.personalRating);
  });

  it("manages references, images and links manually through route handlers", async () => {
    const item = await createTestItem({ wishlist: true });

    const referenceResponse = await createReferenceRoute(
      jsonRequest({
        provider: "boardgamegeek",
        externalId: "12345",
        url: "https://boardgamegeek.com/boardgame/12345/test",
      }),
      itemContext(item.id),
    );
    const referenceBody = await referenceResponse.json();
    const referenceId = referenceBody.externalReferences[0].id;

    const updatedReferenceResponse = await updateReferenceRoute(
      jsonRequest({
        externalId: "12346",
        url: "https://boardgamegeek.com/boardgame/12346/test",
      }),
      referenceContext(item.id, referenceId),
    );
    const updatedReferenceBody = await updatedReferenceResponse.json();

    const imageResponse = await createImageRoute(
      jsonRequest({
        type: "user",
        url: "https://example.com/box.jpg",
        caption: "Box",
      }),
      itemContext(item.id),
    );
    const imageBody = await imageResponse.json();
    const imageId = imageBody.images[0].id;

    const updatedImageResponse = await updateImageRoute(
      jsonRequest({
        caption: "Front box",
        sortOrder: 3,
      }),
      imageContext(item.id, imageId),
    );
    const updatedImageBody = await updatedImageResponse.json();

    const linkResponse = await createLinkRoute(
      jsonRequest({
        type: "rules",
        url: "https://example.com/rules.pdf",
        title: "Rules",
      }),
      itemContext(item.id),
    );
    const linkBody = await linkResponse.json();
    const linkId = linkBody.links[0].id;

    const updatedLinkResponse = await updateLinkRoute(
      jsonRequest({
        type: "official",
        title: "Official site",
      }),
      linkContext(item.id, linkId),
    );
    const updatedLinkBody = await updatedLinkResponse.json();

    await deleteReferenceRoute(
      jsonRequest({}),
      referenceContext(item.id, referenceId),
    );
    await deleteImageRoute(jsonRequest({}), imageContext(item.id, imageId));
    const deleteLinkResponse = await deleteLinkRoute(
      jsonRequest({}),
      linkContext(item.id, linkId),
    );
    const deleteLinkBody = await deleteLinkResponse.json();

    expect(referenceResponse.status).toBe(201);
    expect(updatedReferenceBody.externalReferences[0].externalId).toBe("12346");
    expect(imageResponse.status).toBe(201);
    expect(updatedImageBody.images[0].caption).toBe("Front box");
    expect(updatedImageBody.images[0].sortOrder).toBe(3);
    expect(linkResponse.status).toBe(201);
    expect(updatedLinkBody.links[0].type).toBe("official");
    expect(deleteLinkResponse.status).toBe(200);
    expect(deleteLinkBody.externalReferences).toHaveLength(0);
    expect(deleteLinkBody.images).toHaveLength(0);
    expect(deleteLinkBody.links).toHaveLength(0);
    await expect(prisma.externalReference.count()).resolves.toBe(0);
    await expect(prisma.image.count()).resolves.toBe(0);
    await expect(prisma.link.count()).resolves.toBe(0);
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

  it("returns PROVIDER_DISABLED when BGG sync flag is disabled", async () => {
    process.env.BGG_SYNC_ENABLED = "false";
    const playProvider = vi.spyOn(boardGameGeekPlayProvider, "getUserPlays");

    const response = await syncBggPlaysRoute(
      jsonRequest({ username: "tester" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("PROVIDER_DISABLED");
    expect(playProvider).not.toHaveBeenCalled();
  });

  it("returns JSON import validation errors with field paths", async () => {
    const typeId = randomUUID();

    const response = await importJsonRoute(
      jsonRequest({
        schemaVersion: 1,
        exportedAt: "2026-07-09T00:00:00.000Z",
        data: {
          itemTypes: [
            {
              id: typeId,
              code: "base_game",
              name: "Base game",
              isSystem: true,
              createdAt: "2026-07-09T00:00:00.000Z",
              updatedAt: "2026-07-09T00:00:00.000Z",
            },
          ],
          items: [
            {
              id: randomUUID(),
              typeId,
              title: "",
              sourceMode: "manual",
              categories: [],
              mechanics: [],
              designers: [],
              artists: [],
              publishers: [],
              createdAt: "2026-07-09T00:00:00.000Z",
              updatedAt: "2026-07-09T00:00:00.000Z",
            },
          ],
          userItems: [],
          externalReferences: [],
          images: [],
          links: [],
          purchases: [],
          preorders: [],
          playSessions: [],
          notes: [],
          relations: [],
          tags: [],
          itemTags: [],
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.issues).toContainEqual(
      expect.objectContaining({
        path: "data.items.0.title",
      }),
    );
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

function referenceContext(itemId: string, referenceId: string) {
  return {
    params: Promise.resolve({ itemId, referenceId }),
  };
}

function imageContext(itemId: string, imageId: string) {
  return {
    params: Promise.resolve({ itemId, imageId }),
  };
}

function linkContext(itemId: string, linkId: string) {
  return {
    params: Promise.resolve({ itemId, linkId }),
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
