import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { importExternalItem } from "../search/external-search-service";
import { createPreorder } from "../preorders/preorder-service";
import {
  normalizeTaxonomyName,
  syncItemTaxonomy,
  syncItemTaxonomies,
} from "./taxonomy-service";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("item taxonomy transactions", () => {
  it("keeps omitted and cleared categories independent across a batched lot", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });
    const suffix = randomUUID();
    const items = await prisma.item.createManyAndReturn({
      data: [0, 1, 2].map((index) => ({
        typeId: type.id,
        title: `Batch ${suffix} ${index}`,
      })),
    });
    const original = `Original ${suffix}`;
    const replacement = `Replacement ${suffix}`;
    await prisma.$transaction(async (tx) => {
      await syncItemTaxonomies(
        tx,
        items.map(({ id }) => ({
          itemId: id,
          input: { mechanics: [original], publishers: [original] },
        })),
      );
      await syncItemTaxonomies(tx, [
        { itemId: items[0].id, input: { mechanics: [replacement] } },
        { itemId: items[1].id, input: { mechanics: [] } },
        { itemId: items[2].id, input: { publishers: [replacement] } },
      ]);
    });
    const names = async (id: string) => {
      const item = await prisma.item.findUniqueOrThrow({
        where: { id },
        include: {
          itemMechanics: { include: { mechanic: true } },
          itemPublishers: { include: { publisher: true } },
        },
      });
      return {
        mechanics: item.itemMechanics.map(({ mechanic }) => mechanic.name),
        publishers: item.itemPublishers.map(({ publisher }) => publisher.name),
      };
    };
    expect(await names(items[0].id)).toEqual({
      mechanics: [replacement],
      publishers: [original],
    });
    expect(await names(items[1].id)).toEqual({
      mechanics: [],
      publishers: [original],
    });
    expect(await names(items[2].id)).toEqual({
      mechanics: [original],
      publishers: [replacement],
    });
  });

  it("keeps a large imported taxonomy within a bounded SQL round-trip budget", async () => {
    const client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      }),
      log: [{ emit: "event", level: "query" }],
    });
    let queries = 0;
    client.$on("query", () => {
      queries += 1;
    });
    try {
      const type = await client.itemType.findUniqueOrThrow({
        where: { code: "base_game" },
      });
      const suffix = randomUUID();
      const values = (key: string, count: number) =>
        Array.from(
          { length: count },
          (_, index) => `${key} ${suffix} ${index}`,
        );
      queries = 0;
      const item = await client.$transaction(async (tx) => {
        const item = await tx.item.create({
          data: { title: `Large taxonomy ${suffix}`, typeId: type.id },
        });
        await syncItemTaxonomy(tx, item.id, {
          mechanics: values("Mechanic", 15),
          categories: values("Category", 6),
          designers: values("Designer", 1),
          artists: values("Artist", 2),
          publishers: values("Publisher", 17),
        });
        return item;
      });
      // This shape previously needed 142 round trips and exceeded the default
      // transaction deadline on the configured remote database.
      expect(queries).toBeLessThan(40);
      expect(
        await client.itemMechanic.count({ where: { itemId: item.id } }),
      ).toBe(15);
      expect(
        await client.itemPublisher.count({ where: { itemId: item.id } }),
      ).toBe(17);
    } finally {
      await client.$disconnect();
    }
  });

  it("normalizes and replaces only supplied categories without changing another game's links", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });
    const suffix = randomUUID();
    const first = await prisma.item.create({
      data: { title: `First ${suffix}`, typeId: type.id },
    });
    const second = await prisma.item.create({
      data: { title: `Second ${suffix}`, typeId: type.id },
    });
    const shared = `Shared Mechanic ${suffix}`;
    await prisma.$transaction(async (tx) => {
      await syncItemTaxonomy(tx, first.id, {
        mechanics: [`  ${shared}  `, shared.toUpperCase()],
        publishers: [`Publisher ${suffix}`],
      });
      await syncItemTaxonomy(tx, second.id, { mechanics: [shared] });
    });
    expect(
      await prisma.itemMechanic.count({ where: { itemId: first.id } }),
    ).toBe(1);
    expect(
      await prisma.mechanic.count({
        where: { normalizedName: normalizeTaxonomyName(shared) },
      }),
    ).toBe(1);
    await prisma.$transaction((tx) =>
      syncItemTaxonomy(tx, first.id, { mechanics: [] }),
    );
    expect(
      await prisma.itemMechanic.count({ where: { itemId: first.id } }),
    ).toBe(0);
    expect(
      await prisma.itemPublisher.count({ where: { itemId: first.id } }),
    ).toBe(1);
    expect(
      await prisma.itemMechanic.count({ where: { itemId: second.id } }),
    ).toBe(1);
  });

  it("rolls back taxonomy replacements and new directory entries with the enclosing transaction", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });
    const suffix = randomUUID();
    const item = await prisma.item.create({
      data: { title: `Rollback ${suffix}`, typeId: type.id },
    });
    const original = `Original ${suffix}`;
    const replacement = `Replacement ${suffix}`;
    await prisma.$transaction((tx) =>
      syncItemTaxonomy(tx, item.id, { mechanics: [original] }),
    );
    await expect(
      prisma.$transaction(async (tx) => {
        await syncItemTaxonomy(tx, item.id, {
          mechanics: [replacement],
          publishers: [replacement],
        });
        throw new Error("Later operation failed");
      }),
    ).rejects.toThrow("Later operation failed");
    const links = await prisma.itemMechanic.findMany({
      where: { itemId: item.id },
      include: { mechanic: true },
    });
    expect(links.map((link) => link.mechanic.name)).toEqual([original]);
    expect(
      await prisma.mechanic.findUnique({
        where: { normalizedName: normalizeTaxonomyName(replacement) },
      }),
    ).toBeNull();
    expect(
      await prisma.publisher.findUnique({
        where: { normalizedName: normalizeTaxonomyName(replacement) },
      }),
    ).toBeNull();
  });

  it("does not create dictionary entries for a missing parent", async () => {
    const name = `Missing parent ${randomUUID()}`;
    await expect(
      prisma.$transaction((tx) =>
        syncItemTaxonomy(tx, randomUUID(), { mechanics: [name] }),
      ),
    ).rejects.toMatchObject({ code: "P2025" });
    expect(
      await prisma.mechanic.findUnique({
        where: { normalizedName: normalizeTaxonomyName(name) },
      }),
    ).toBeNull();
  });

  it("imports a BGG card with existing and new taxonomy entries before creating a preorder", async () => {
    vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
    const suffix = randomUUID();
    const mechanics = [
      "Deck Building",
      "Worker Placement",
      "Dice Rolling",
      "Hand Management",
      "Solo",
    ].map((name) => `${name} ${suffix}`);
    const categories = ["Fantasy", "Adventure", "Miniatures"].map(
      (name) => `${name} ${suffix}`,
    );
    const designers = ["Designer One", "Designer Two"].map(
      (name) => `${name} ${suffix}`,
    );
    const artists = ["Artist One", "Artist Two"].map(
      (name) => `${name} ${suffix}`,
    );
    const publishers = ["Publisher One", "Publisher Two"].map(
      (name) => `${name} ${suffix}`,
    );
    for (const name of mechanics.slice(0, 3))
      await prisma.mechanic.create({
        data: { name, normalizedName: normalizeTaxonomyName(name) },
      });
    await prisma.publisher.create({
      data: {
        name: publishers[0],
        normalizedName: normalizeTaxonomyName(publishers[0]),
      },
    });
    vi.spyOn(boardGameGeekProvider, "getItem").mockResolvedValue({
      provider: "boardgamegeek",
      externalId: suffix,
      title: `Imported ${suffix}`,
      itemTypeCode: "base_game",
      mechanics,
      categories,
      designers,
      artists,
      publishers,
      imageUrl: "https://example.com/cover.jpg",
      url: `https://boardgamegeek.com/boardgame/${suffix}`,
    });
    const imported = await importExternalItem({
      provider: "boardgamegeek",
      externalId: suffix,
      target: "reference_only",
    });
    const item = await prisma.item.findUniqueOrThrow({
      where: { id: imported.item.id },
      include: {
        itemMechanics: true,
        itemCategories: true,
        itemDesigners: true,
        itemArtists: true,
        itemPublishers: true,
      },
    });
    expect(item.itemMechanics).toHaveLength(mechanics.length);
    expect(item.itemCategories).toHaveLength(categories.length);
    expect(item.itemDesigners).toHaveLength(designers.length);
    expect(item.itemArtists).toHaveLength(artists.length);
    expect(item.itemPublishers).toHaveLength(publishers.length);
    const preorder = await createPreorder(item.id, {
      shop: publishers[0],
      price: 5000,
      currency: "RUB",
      status: "ordered",
    });
    expect(preorder.itemId).toBe(item.id);
    expect(
      await prisma.mechanic.count({
        where: { normalizedName: { in: mechanics.map(normalizeTaxonomyName) } },
      }),
    ).toBe(mechanics.length);
  });
});
