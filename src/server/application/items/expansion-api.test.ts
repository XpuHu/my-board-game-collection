import { randomUUID } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { getGameExpansionOptions } from "./expansion-options-service";
import { attachExpansions, attachExpansionsSchema } from "./expansion-service";
import { executeItemAction, itemActionSchema } from "./item-action-service";
let baseType: string;
let expansionType: string;
beforeAll(async () => {
  baseType = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
  expansionType = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "expansion" } })
  ).id;
});
beforeEach(() => {
  vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function base() {
  return prisma.item.create({
    data: {
      typeId: baseType,
      title: "Base",
      externalReferences: {
        create: {
          provider: "boardgamegeek",
          externalId: String(Date.now()) + Math.floor(Math.random() * 10000),
        },
      },
    },
  });
}
const source = () => ({
  provider: "boardgamegeek" as const,
  externalId: String(Date.now()) + Math.floor(Math.random() * 10000),
});
const metadata = (externalId: string) => ({
  provider: "boardgamegeek" as const,
  externalId,
  title: `Expansion ${externalId}`,
  itemTypeCode: "expansion" as const,
  categories: [],
  mechanics: [],
  designers: [],
  artists: [],
  publishers: [],
});
describe("expansion catalogue and import", () => {
  it("saves a twelve-position imported preorder lot without repeating taxonomy queries for every position", async () => {
    const measured = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      }),
      log: [{ emit: "event", level: "query" }],
    });
    const cache = globalThis as unknown as { prisma?: PrismaClient };
    const previous = cache.prisma;
    cache.prisma = measured;
    let queries = 0;
    measured.$on("query", () => {
      queries += 1;
    });
    try {
      const game = await base();
      const prefix = randomUUID();
      const shop = `Shop ${prefix}`;
      await measured.publisher.create({
        data: { name: shop, normalizedName: shop.toLowerCase() },
      });
      const ids = Array.from(
        { length: 12 },
        (_, index) => `${Date.now()}${index}`,
      );
      const values = (name: string, count: number) =>
        Array.from(
          { length: count },
          (_, index) => `${prefix} ${name} ${index}`,
        );
      const getItem = vi
        .spyOn(boardGameGeekProvider, "getItem")
        .mockImplementation(async (externalId) => ({
          ...metadata(externalId),
          itemTypeCode:
            ids.indexOf(externalId) < 10 ? "expansion" : "accessory",
          mechanics: [
            ...values("Mechanic", 5),
            `${prefix} unique ${externalId}`,
          ],
          categories: values("Category", 2),
          artists: values("Artist", 2),
          publishers: values("Publisher", 4),
          imageUrl: "https://example.com/cover.jpg",
          url: "https://example.com/game",
        }));
      const selection = (externalId: string) => ({
        external: { provider: "boardgamegeek", externalId },
      });
      const input = itemActionSchema.parse({
        operationId: randomUUID(),
        target: "preorder",
        itemId: game.id,
        preorder: {
          shop: `  ${shop.toUpperCase()}  `,
          price: 50000,
          currency: "RUB",
          status: "ordered",
          pricingMode: "lot",
        },
        expansions: ids.slice(0, 10).map(selection),
        accessories: ids.slice(10).map(selection),
      });
      queries = 0;
      const result = await executeItemAction(input);
      // The reported failure exceeded 30 seconds after 413 queries, before it
      // had even finished importing the lot. Bound the complete save instead.
      expect(queries).toBeLessThan(220);
      const children = await measured.preorder.findMany({
        where: { parentId: result.preorderId },
        include: {
          item: {
            include: {
              itemMechanics: true,
              itemPublishers: true,
              images: true,
            },
          },
        },
      });
      expect(children).toHaveLength(12);
      expect(children.every((child) => child.shop === shop)).toBe(true);
      expect(
        children.every(
          ({ item }) =>
            item.itemMechanics.length === 6 && item.itemPublishers.length === 4,
        ),
      ).toBe(true);
      expect(
        children.every(({ item }) => item.images[0]?.type === "reference"),
      ).toBe(true);
      expect(
        await measured.itemRelation.count({ where: { parentItemId: game.id } }),
      ).toBe(12);
      getItem.mockRejectedValue(new Error("Provider now unavailable"));
      expect(await executeItemAction(input)).toEqual(result);
      expect(getItem).toHaveBeenCalledTimes(12);
      expect(
        await measured.preorder.count({
          where: { parentId: result.preorderId },
        }),
      ).toBe(12);
    } finally {
      cache.prisma = previous;
      await measured.$disconnect();
    }
  });

  it("combines remote options with existing links without importing the catalogue or duplicating known items", async () => {
    const game = await base();
    const external = source();
    const extra = await prisma.item.create({
      data: {
        typeId: expansionType,
        title: "Known",
        externalReferences: { create: external },
      },
    });
    await prisma.itemRelation.create({
      data: {
        parentItemId: game.id,
        childItemId: extra.id,
        relationType: "expands",
      },
    });
    const other = source();
    vi.spyOn(boardGameGeekProvider, "getRelatedItems").mockResolvedValue([
      {
        ...metadata(external.externalId),
        russianTitle: "Русское дополнение",
        year: 2027,
      },
      metadata(other.externalId),
    ]);
    const before = await prisma.item.count();
    const result = await getGameExpansionOptions(game.id);
    expect(result.data).toHaveLength(2);
    expect(result.data.find((item) => item.itemId === extra.id)).toMatchObject({
      russianTitle: "Русское дополнение",
      year: 2027,
    });
    expect(result.data.find((item) => item.itemId === extra.id)?.title).toBe(
      "Known",
    );
    expect(
      result.data.some(
        (item) =>
          item.external?.externalId === other.externalId && !item.itemId,
      ),
    ).toBe(true);
    expect(await prisma.item.count()).toBe(before);
  });
  it("shows provider failure explicitly and retains saved expansion links", async () => {
    const game = await base();
    vi.spyOn(boardGameGeekProvider, "getRelatedItems").mockRejectedValue(
      new Error("API unavailable"),
    );
    expect(
      (await getGameExpansionOptions(game.id)).warnings?.[0].message,
    ).toContain("Не удалось загрузить");
  });
  it("imports only selected expansions atomically and replays without depending on the provider", async () => {
    const game = await base();
    const external = source();
    const fetchItem = vi
      .spyOn(boardGameGeekProvider, "getItem")
      .mockResolvedValue(metadata(external.externalId));
    const input = attachExpansionsSchema.parse({
      operationId: randomUUID(),
      expansions: [{ external }],
    });
    const first = await attachExpansions(game.id, input);
    fetchItem.mockRejectedValue(new Error("Now offline"));
    expect(await attachExpansions(game.id, input)).toEqual(first);
    expect(fetchItem).toHaveBeenCalledTimes(1);
    expect(
      await prisma.itemRelation.count({ where: { parentItemId: game.id } }),
    ).toBe(1);
    expect(await prisma.externalReference.count({ where: external })).toBe(1);
    const created = await prisma.item.findUniqueOrThrow({
      where: { id: first.expansionIds[0] },
      include: { userItem: true },
    });
    expect(created.sourceMode).toBe("imported");
    expect(created.userItem?.owned).toBe(false);
  });
  it("creates an imported expansion preorder with its own price and rolls back imports on later failure", async () => {
    const game = await base();
    const external = source();
    vi.spyOn(boardGameGeekProvider, "getItem").mockResolvedValue(
      metadata(external.externalId),
    );
    const common = {
      operationId: randomUUID(),
      itemId: game.id,
      target: "preorder",
      preorder: {
        shop: "Shop",
        price: 100,
        currency: "RUB",
        status: "ordered",
      },
      expansions: [
        { external, price: 20.5 },
        { itemId: randomUUID(), price: 10 },
      ],
    };
    await expect(
      executeItemAction(itemActionSchema.parse(common)),
    ).rejects.toMatchObject({ status: 404 });
    expect(await prisma.externalReference.count({ where: external })).toBe(0);
    expect(await prisma.preorder.count({ where: { itemId: game.id } })).toBe(0);
    const result = await executeItemAction(
      itemActionSchema.parse({
        ...common,
        operationId: randomUUID(),
        expansions: [{ external, price: 20.5 }],
      }),
    );
    const receipt = await prisma.preorder.findUniqueOrThrow({
      where: { id: result.expansionPreorderIds![0] },
    });
    expect(Number(receipt.price)).toBe(20.5);
  });
});
