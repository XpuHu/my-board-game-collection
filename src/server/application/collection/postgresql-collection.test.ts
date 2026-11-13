import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { listCollectionCards } from "./collection-service";
import { searchLocalItems } from "../items/item-service";
import { listPreorderItems } from "../preorders/preorder-service";

let typeId: string;
beforeAll(async () => {
  typeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
});

async function owned(title: string, rating: number | null = null) {
  return prisma.item.create({
    data: {
      title,
      typeId,
      userItem: {
        create: {
          owned: true,
          ownedAt: new Date("2026-11-13T00:00:00.000Z"),
          status: "active",
          personalRating: rating,
        },
      },
    },
  });
}

describe("PostgreSQL collection queries", () => {
  it("reuses an existing local item regardless of title case", async () => {
    const marker = randomUUID();
    const item = await owned(`${marker} Wingspan`);
    const result = await searchLocalItems(`${marker} wingspan`);
    expect(result.data.map((entry) => entry.id)).toContain(item.id);
  });

  it("keeps unknown preorder dates before dated entries as in SQLite", async () => {
    const item = await owned(randomUUID());
    const unknown = await prisma.preorder.create({
      data: {
        itemId: item.id,
        shop: "Test",
        price: 0,
        currency: "RUB",
        status: "ordered",
        expectedDatePrecision: "unknown",
      },
    });
    const dated = await prisma.preorder.create({
      data: {
        itemId: item.id,
        shop: "Test",
        price: 0,
        currency: "RUB",
        status: "ordered",
        expectedDate: new Date("2026-12-01T00:00:00.000Z"),
      },
    });
    const result = await listPreorderItems(
      { itemId: item.id },
      { page: 1, pageSize: 10 },
    );
    expect(result.data.map((entry) => entry.id)).toEqual([
      unknown.id,
      dated.id,
    ]);
  });

  it("searches Cyrillic names regardless of case and counts grouped play rows", async () => {
    const marker = randomUUID();
    const item = await owned(`${marker} Крылья`);
    await prisma.playSession.createMany({
      data: [1, 2].map(() => ({
        itemId: item.id,
        playedAt: new Date("2026-11-13T00:00:00.000Z"),
      })),
    });
    const result = await listCollectionCards(
      { q: `${marker} крылья`, playsMin: 2 },
      { page: 1, pageSize: 10 },
    );
    expect(result.pagination.total).toBe(1);
    expect(result.data[0].item.id).toBe(item.id);
  });

  it("preserves NULL placement and stable pagination when sorting ratings", async () => {
    const marker = randomUUID();
    const missing = await owned(`${marker} Missing`);
    const rated = await owned(`${marker} Rated`, 8);
    const asc = await listCollectionCards(
      { q: marker, sort: "rating", direction: "asc" },
      { page: 1, pageSize: 1 },
    );
    const desc = await listCollectionCards(
      { q: marker, sort: "rating", direction: "desc" },
      { page: 1, pageSize: 1 },
    );
    expect(asc.pagination.total).toBe(2);
    expect(asc.data[0].item.id).toBe(missing.id);
    expect(desc.data[0].item.id).toBe(rated.id);
  });
});
