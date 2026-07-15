import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { GET as getCollection } from "@/app/api/collection/route";
import { GET as getCollectionDetail } from "@/app/api/collection/[itemId]/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getPlays } from "@/app/api/plays/route";
import { GET as getPreorders } from "@/app/api/preorders/route";
import { GET as getWishlist } from "@/app/api/wishlist/route";
import { GET as getWishlistDetail } from "@/app/api/wishlist/[itemId]/route";
import { prisma } from "@/infrastructure/database/prisma";
import { mapPreorderEvent } from "@/server/application/items/item-mappers";

describe("foundation target and legacy contracts", () => {
  beforeEach(clearDomainData);

  it("serves separate target and legacy collection views with state fallbacks", async () => {
    const item = await createItem("Contract game", { owned: true });
    await prisma.playSession.create({
      data: {
        itemId: item.id,
        playedAt: new Date("2026-07-10T12:00:00.000Z"),
        result: "win",
        playerNames: [],
        usedItemIds: [],
      },
    });
    await prisma.image.create({
      data: { itemId: item.id, type: "user", url: "https://example.com/game.jpg" },
    });
    await prisma.purchase.create({
      data: {
        itemId: item.id,
        shop: "Shop",
        price: 90,
        currency: "USD",
        totalPrice: 100,
        deliveryCost: 10,
      },
    });

    const target = await json(getCollection(request("/api/collection")));
    const legacy = await json(
      getCollection(request("/api/collection?view=legacy")),
    );

    expect(target.data[0]).toMatchObject({
      item: { title: "Contract game" },
      userItem: {
        states: ["owned", "played"],
        favorite: false,
      },
      plays: { count: 1, lastResult: "win" },
      imagesCount: 1,
    });
    expect(target.data[0].userItem.ownedAt).toMatch(/^\d{4}-/);
    expect(target.data[0]).not.toHaveProperty("playsCount");
    expect(legacy.data[0]).toHaveProperty("playsCount", 1);
    expect(legacy.data[0]).not.toHaveProperty("plays");

    const detailResponse = await getCollectionDetail(
      request(`/api/collection/${item.id}`),
      { params: Promise.resolve({ itemId: item.id }) },
    );
    const detail = await detailResponse.json();
    expect(detail.userItem).toMatchObject({
      lifecycleStatus: "active",
      states: ["owned", "played"],
      favorite: false,
    });
    expect(detail.playSummary).toMatchObject({ count: 1 });
    expect(detail.item.images[0]).toMatchObject({
      type: "user",
      url: "https://example.com/game.jpg",
    });
    expect(detail.item.images[0]).not.toHaveProperty("itemId");
    expect(detail.item.images[0]).not.toHaveProperty("createdAt");
    expect(detail.purchases[0]).toMatchObject({
      price: { amount: 90, currency: "USD" },
      deliveryCost: { amount: 10, currency: "USD" },
      totalPrice: { amount: 100, currency: "USD" },
    });
    expect(detail.purchases[0]).not.toHaveProperty("itemId");
  });

  it("returns 400 for invalid enums, ranges, dates and conflicting filters", async () => {
    for (const query of [
      "type=unknown",
      "personalRating=11",
      "playsMin=5&playsMax=2",
      "lastPlayedFrom=2026-02-30",
      "neverPlayed=true&lastPlayedFrom=2026-01-01",
      "pageSize=25",
    ]) {
      const response = await getCollection(request(`/api/collection?${query}`));
      expect(response.status, query).toBe(400);
    }

    const playsResponse = await getPlays(
      request("/api/plays?player=Anna"),
    );
    expect(playsResponse.status).toBe(400);
    expect(
      (await getWishlist(request("/api/wishlist?interestLevel=9"))).status,
    ).toBe(400);
    expect(
      (await getPreorders(request("/api/preorders?group=pending"))).status,
    ).toBe(400);
  });

  it("excludes owned records from wishlist list and detail", async () => {
    const owned = await createItem("Owned wishlist legacy", {
      owned: true,
      wishlist: true,
    });
    const wanted = await createItem("Wanted", { wishlist: true });

    const response = await getWishlist(request("/api/wishlist"));
    const body = await response.json();
    expect(body.pagination.total).toBe(1);
    expect(body.data[0].item.title).toBe("Wanted");
    const legacy = await json(
      getWishlist(request("/api/wishlist?view=legacy")),
    );
    expect(legacy.data[0]).toHaveProperty("playsCount");
    expect(legacy.data[0]).not.toHaveProperty("mechanics");

    const ownedDetail = await getWishlistDetail(
      request(`/api/wishlist/${owned.id}`),
      { params: Promise.resolve({ itemId: owned.id }) },
    );
    const wantedDetail = await getWishlistDetail(
      request(`/api/wishlist/${wanted.id}`),
      { params: Promise.resolve({ itemId: wanted.id }) },
    );
    expect(ownedDetail.status).toBe(404);
    expect(wantedDetail.status).toBe(200);
  });

  it("returns compact used items, Money DTO and preorder precision fallbacks", async () => {
    const base = await createItem("Base", { owned: true });
    const expansion = await createItem("Expansion", { owned: true });
    await prisma.playSession.create({
      data: {
        itemId: base.id,
        playedAt: new Date("2026-07-01T12:00:00.000Z"),
        usedItemIds: [expansion.id],
        playerNames: [],
      },
    });
    await prisma.preorder.create({
      data: {
        itemId: base.id,
        shop: "Shop",
        price: 100,
        currency: "USD",
        expectedDate: null,
        status: "ordered",
      },
    });

    const plays = await json(
      getPlays(request("/api/plays?from=2026-07-01&to=2026-07-31")),
    );
    const preorders = await json(getPreorders(request("/api/preorders")));
    const legacyPlays = await json(
      getPlays(
        request(
          "/api/plays?view=legacy&from=2026-07-01&to=2026-07-31",
        ),
      ),
    );
    const legacyPreorders = await json(
      getPreorders(request("/api/preorders?view=legacy")),
    );
    expect(plays.data[0]).toMatchObject({
      startedAt: null,
      personalRating: null,
      usedItems: [{ title: "Expansion" }],
    });
    expect(plays.data[0]).not.toHaveProperty("usedItemIds");
    expect(legacyPlays.data[0]).toHaveProperty("usedItemIds", [expansion.id]);
    expect(preorders.data[0]).toMatchObject({
      price: { amount: 100, currency: "USD" },
      expectedDate: null,
      expectedDatePrecision: "unknown",
    });
    expect(legacyPreorders[0]).toMatchObject({ price: 100, currency: "USD" });
    expect(legacyPreorders[0]).not.toHaveProperty("uiStatus");
  });

  it("normalizes legacy expected-date event strings without rewriting storage", async () => {
    const item = await createItem("Legacy event", { wishlist: true });
    const preorder = await prisma.preorder.create({
      data: {
        itemId: item.id,
        shop: "Shop",
        price: 10,
        currency: "USD",
        status: "ordered",
      },
    });
    const stored = await prisma.preorderEvent.create({
      data: {
        preorderId: preorder.id,
        type: "expected_date_changed",
        oldValue: "2026-08-01T00:00:00.000Z",
        newValue: null,
      },
    });

    expect(mapPreorderEvent(stored)).toMatchObject({
      type: "expected_date_changed",
      oldValue: {
        expectedDate: "2026-08-01T00:00:00.000Z",
        expectedDatePrecision: "day",
      },
      newValue: {
        expectedDate: null,
        expectedDatePrecision: "unknown",
      },
      legacyFormat: true,
    });
    await expect(
      prisma.preorderEvent.findUniqueOrThrow({ where: { id: stored.id } }),
    ).resolves.toMatchObject({ oldValue: "2026-08-01T00:00:00.000Z" });
  });

  it("keeps stable SQL pagination totals and dashboard limits", async () => {
    for (const count of [0, 1, 24, 25, 101]) {
      await prisma.userItem.deleteMany();
      await prisma.item.deleteMany();
      await seedCollection(count);
      const first = await json(getCollection(request("/api/collection")));
      const lastPage = Math.max(1, Math.ceil(count / 24));
      const last = await json(
        getCollection(request(`/api/collection?page=${lastPage}`)),
      );
      expect(first.pagination.total, `total for ${count}`).toBe(count);
      expect(first.data.length, `first page for ${count}`).toBe(
        Math.min(count, 24),
      );
      expect(last.pagination.total, `last total for ${count}`).toBe(count);
      expect(last.data.length, `last page for ${count}`).toBe(
        count === 0 ? 0 : count - (lastPage - 1) * 24,
      );
    }

    const dashboard = await json(getDashboard());
    expect(dashboard.recentlyAdded.length).toBeLessThanOrEqual(4);
  });
});

describe("BGG attribution boundary", () => {
  it("does not render attribution outside AppShell", () => {
    const files = collectTsx(join(process.cwd(), "src"));
    const offenders = files.filter((file) => {
      const normalized = file.replaceAll("\\", "/");
      if (normalized.endsWith("components/app-shell.tsx")) return false;
      if (normalized.endsWith("components/bgg-attribution.tsx")) return false;
      const source = readFileSync(file, "utf8");
      return source.includes("BggAttribution") || source.includes("powered_by_bgg");
    });
    expect(offenders).toEqual([]);
  });
});

async function createItem(
  title: string,
  state: { owned?: boolean; wishlist?: boolean },
) {
  const type = await prisma.itemType.findUniqueOrThrow({
    where: { code: "base_game" },
  });
  return prisma.item.create({
    data: {
      typeId: type.id,
      title,
      categories: [],
      mechanics: [],
      designers: [],
      artists: [],
      publishers: [],
      userItem: {
        create: {
          owned: state.owned ?? false,
          wishlist: state.wishlist ?? false,
          status: state.owned ? "owned" : "wishlist",
        },
      },
    },
  });
}

async function seedCollection(count: number) {
  if (count === 0) return;
  const type = await prisma.itemType.findUniqueOrThrow({
    where: { code: "base_game" },
  });
  const items = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    typeId: type.id,
    title: `Game ${String(index).padStart(3, "0")}`,
  }));
  await prisma.item.createMany({ data: items });
  await prisma.userItem.createMany({
    data: items.map((item) => ({
      id: randomUUID(),
      itemId: item.id,
      owned: true,
      wishlist: false,
      status: "owned",
    })),
  });
}

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Promise<Response>) {
  return (await response).json();
}

function collectTsx(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectTsx(path)
      : entry.name.endsWith(".tsx")
        ? [path]
        : [];
  });
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
