import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import {
  executeItemAction,
  itemActionSchema,
} from "../items/item-action-service";
import { updatePreorder } from "./preorder-service";

async function fixture(count: number) {
  const type = await prisma.itemType.findUniqueOrThrow({
    where: { code: "base_game" },
  });
  return executeItemAction(
    itemActionSchema.parse({
      operationId: randomUUID(),
      target: "preorder",
      manual: { title: `Receive ${randomUUID()}`, typeId: type.id },
      preorder: {
        shop: "Receive shop",
        price: 5000,
        currency: "RUB",
        status: "paid",
        pricingMode: "lot",
        expectedDate: "2027-01-01",
        expectedDatePrecision: "month",
      },
      expansions: Array.from({ length: count }, () => ({
        title: `Extra ${randomUUID()}`,
      })),
    }),
  );
}

describe("receiving preorder lots", () => {
  it("uses a selected receipt date and corrects the shared lot date without receiving items again", async () => {
    const lot = await fixture(2);
    const firstDate = "2026-11-01T00:00:00.000Z";
    const correctedDate = "2026-11-05T00:00:00.000Z";
    await updatePreorder(lot.preorderId!, {
      status: "received",
      receivedDate: firstDate,
    });
    const owner = await prisma.userItem.findUniqueOrThrow({
      where: { itemId: lot.itemId },
    });
    const first = await prisma.preorder.findMany({
      where: { OR: [{ id: lot.preorderId! }, { parentId: lot.preorderId! }] },
    });
    expect(
      first.every(
        (position) => position.receivedDate?.toISOString() === firstDate,
      ),
    ).toBe(true);
    await updatePreorder(lot.preorderId!, { receivedDate: correctedDate });
    const corrected = await prisma.preorder.findMany({
      where: { id: { in: first.map(({ id }) => id) } },
    });
    expect(
      corrected.every(
        (position) => position.receivedDate?.toISOString() === correctedDate,
      ),
    ).toBe(true);
    const again = await updatePreorder(lot.preorderId!, { status: "received" });
    expect(again.receivedDate).toBe(correctedDate);
    expect(
      await prisma.preorderEvent.count({
        where: {
          preorderId: { in: first.map(({ id }) => id) },
          type: "status_changed",
        },
      }),
    ).toBe(3);
    expect(
      (
        await prisma.userItem.findUniqueOrThrow({
          where: { itemId: lot.itemId },
        })
      ).ownedAt,
    ).toEqual(owner.ownedAt);
    await updatePreorder(lot.preorderId!, {
      receivedDate: firstDate,
      comment: "Date corrected in editor",
    });
    expect(
      (
        await prisma.preorder.findMany({
          where: { id: { in: first.map(({ id }) => id) } },
        })
      ).every((position) => position.receivedDate?.toISOString() === firstDate),
    ).toBe(true);
  });

  it("preserves a separately received position when correcting the lot date", async () => {
    const lot = await fixture(2);
    const earlierDate = new Date("2026-01-01T00:00:00Z");
    const earlier = lot.expansionPreorderIds![0];
    await prisma.preorder.update({
      where: { id: earlier },
      data: { status: "received", receivedDate: earlierDate },
    });
    await updatePreorder(lot.preorderId!, {
      status: "received",
      receivedDate: "2026-11-01T00:00:00Z",
    });
    await updatePreorder(lot.preorderId!, {
      receivedDate: "2026-11-05T00:00:00Z",
    });
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: earlier } }))
        .receivedDate,
    ).toEqual(earlierDate);
  });

  it("receives twelve positions with bounded queries, one date and repeat-safe events", async () => {
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
      const lot = await fixture(12);
      const child = await measured.preorder.findUniqueOrThrow({
        where: { id: lot.expansionPreorderIds![0] },
      });
      const ownedAt = new Date("2020-01-01T00:00:00Z");
      await measured.userItem.update({
        where: { itemId: child.itemId },
        data: { owned: true, ownedAt, favorite: true, location: "Shelf" },
      });
      await measured.preorder.update({
        where: { id: child.id },
        data: { fullyPaid: null },
      });
      const started = Date.now();
      queries = 0;
      const received = await updatePreorder(lot.preorderId!, {
        status: "received",
      });
      expect(queries).toBeLessThan(22);
      expect(new Date(received.receivedDate!).getTime()).toBeGreaterThanOrEqual(
        started,
      );
      expect(new Date(received.receivedDate!).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      const children = await measured.preorder.findMany({
        where: { parentId: lot.preorderId },
      });
      expect(children).toHaveLength(12);
      expect(
        children.every(
          (child) =>
            child.status === "received" &&
            child.receivedDate?.toISOString() === received.receivedDate,
        ),
      ).toBe(true);
      expect(
        (await measured.preorder.findUniqueOrThrow({ where: { id: child.id } }))
          .fullyPaid,
      ).toBe(true);
      const ids = [lot.itemId, ...children.map(({ itemId }) => itemId)];
      expect(
        await measured.userItem.count({
          where: { itemId: { in: ids }, owned: true, wishlist: false },
        }),
      ).toBe(13);
      expect(
        await measured.userItem.findUnique({ where: { itemId: child.itemId } }),
      ).toMatchObject({ ownedAt, favorite: true, location: "Shelf" });
      const again = await updatePreorder(lot.preorderId!, {
        status: "received",
      });
      expect(again.receivedDate).toBe(received.receivedDate);
      expect(
        await measured.preorderEvent.count({
          where: {
            preorderId: {
              in: [lot.preorderId!, ...children.map(({ id }) => id)],
            },
            type: "status_changed",
          },
        }),
      ).toBe(13);
    } finally {
      cache.prisma = previous;
      await measured.$disconnect();
    }
  });

  it("preserves cancelled positions and previously received dates", async () => {
    const lot = await fixture(2);
    const [cancelled, earlier] = lot.expansionPreorderIds!;
    const earlierDate = new Date("2026-01-01T00:00:00Z");
    await prisma.preorder.update({
      where: { id: cancelled },
      data: { status: "cancelled" },
    });
    await prisma.preorder.update({
      where: { id: earlier },
      data: { status: "received", receivedDate: earlierDate },
    });
    await updatePreorder(lot.preorderId!, { status: "received" });
    expect(
      await prisma.preorder.findUnique({ where: { id: cancelled } }),
    ).toMatchObject({ status: "cancelled", receivedDate: null });
    expect(
      await prisma.preorder.findUnique({ where: { id: earlier } }),
    ).toMatchObject({ status: "received", receivedDate: earlierDate });
    expect(
      await prisma.preorderEvent.count({
        where: { preorderId: { in: [cancelled, earlier] } },
      }),
    ).toBe(0);
  });

  it("rejects a missing date, missing preorder and receipt of a cancelled root atomically", async () => {
    const lot = await fixture(1);
    await expect(
      updatePreorder(lot.preorderId!, {
        status: "received",
        receivedDate: null,
      }),
    ).rejects.toMatchObject({ code: "RECEIVED_DATE_REQUIRED" });
    await expect(
      updatePreorder(randomUUID(), { status: "received" }),
    ).rejects.toMatchObject({ status: 404 });
    await updatePreorder(lot.preorderId!, { status: "cancelled" });
    await expect(
      updatePreorder(lot.preorderId!, { status: "received" }),
    ).rejects.toMatchObject({ code: "INVALID_PREORDER_TRANSITION" });
    expect(
      await prisma.preorder.findUnique({ where: { id: lot.preorderId! } }),
    ).toMatchObject({ status: "cancelled", receivedDate: null });
  });
});
