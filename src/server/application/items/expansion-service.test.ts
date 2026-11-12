import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { attachExpansions, attachExpansionsSchema } from "./expansion-service";
import { executeItemAction, itemActionSchema } from "./item-action-service";
import { getItemCard, searchLocalItems } from "./item-service";
let baseTypeId: string;
let expansionTypeId: string;
beforeAll(async () => {
  baseTypeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
  expansionTypeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "expansion" } })
  ).id;
});
const base = () =>
  prisma.item.create({
    data: { typeId: baseTypeId, title: `Base ${randomUUID()}` },
  });
const expansion = () =>
  prisma.item.create({
    data: { typeId: expansionTypeId, title: `Expansion ${randomUUID()}` },
  });
const order = {
  shop: "Shop",
  price: 1200.55,
  currency: "RUB",
  status: "paid",
  expectedDatePrecision: "month",
  expectedDate: "2027-02-01",
};
describe("game expansions and preorder positions", () => {
  it("attaches existing and new expansions without changing ownership; replay and repeated links are safe", async () => {
    const game = await base();
    const extra = await expansion();
    const input = attachExpansionsSchema.parse({
      operationId: randomUUID(),
      expansions: [{ itemId: extra.id }, { title: "New expansion" }],
    });
    const first = await attachExpansions(game.id, input);
    expect(await attachExpansions(game.id, input)).toEqual(first);
    await attachExpansions(game.id, {
      operationId: randomUUID(),
      expansions: [{ itemId: extra.id }],
    });
    const card = await getItemCard(game.id);
    expect(
      card.item.relations.filter((r) => r.relationType === "expands"),
    ).toHaveLength(2);
    expect(card.item.relations.every((r) => r.direction === "child")).toBe(
      true,
    );
    expect((await getItemCard(extra.id)).item.relations[0].direction).toBe(
      "parent",
    );
    const created = await prisma.item.findUniqueOrThrow({
      where: { id: first.expansionIds[1] },
      include: { type: true, userItem: true },
    });
    expect(created.type.code).toBe("expansion");
    expect(created.userItem?.owned).toBe(false);
  });
  it("creates separately priced preorders atomically and replays without duplicates", async () => {
    const game = await base();
    const extra = await expansion();
    const input = itemActionSchema.parse({
      operationId: randomUUID(),
      itemId: game.id,
      target: "preorder",
      preorder: order,
      expansions: [
        { itemId: extra.id, price: 350.25 },
        { title: "Free promo expansion", price: 0 },
      ],
    });
    const result = await executeItemAction(input);
    expect(await executeItemAction(input)).toEqual(result);
    const rows = await prisma.preorder.findMany({
      where: {
        itemId: {
          in: [
            game.id,
            extra.id,
            ...(
              await prisma.itemRelation.findMany({
                where: { parentItemId: game.id },
              })
            ).map((r) => r.childItemId),
          ],
        },
      },
      orderBy: { price: "desc" },
    });
    expect(rows.map((row) => Number(row.price))).toEqual([1200.55, 350.25, 0]);
    expect(
      rows.every(
        (row) =>
          row.shop === "Shop" &&
          row.currency === "RUB" &&
          row.status === "paid" &&
          row.expectedDatePrecision === "month",
      ),
    ).toBe(true);
    expect(
      rows.every(
        (row) => row.expectedDate?.toISOString() === "2027-02-01T00:00:00.000Z",
      ),
    ).toBe(true);
  });
  it("rolls back the base card, all orders and new expansions if a later selection is missing", async () => {
    const title = `Rollback ${randomUUID()}`;
    const extraTitle = `Extra ${randomUUID()}`;
    const input = itemActionSchema.parse({
      operationId: randomUUID(),
      manual: { title, typeId: baseTypeId },
      target: "preorder",
      preorder: order,
      expansions: [
        { title: extraTitle, price: 10 },
        { itemId: randomUUID(), price: 20 },
      ],
    });
    await expect(executeItemAction(input)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await prisma.item.count({
        where: { title: { in: [title, extraTitle] } },
      }),
    ).toBe(0);
    expect(
      await prisma.commandReceipt.findUnique({
        where: { id: input.operationId },
      }),
    ).toBeNull();
  });
  it("rejects base-as-expansion, wrong type, duplicates and deleted cards", async () => {
    const game = await base();
    const other = await base();
    const extra = await expansion();
    for (const ids of [[game.id], [other.id], [extra.id, extra.id]]) {
      await expect(
        attachExpansions(game.id, {
          operationId: randomUUID(),
          expansions: ids.map((itemId) => ({ itemId })),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EXPANSION" });
    }
    expect(
      await prisma.itemRelation.count({ where: { parentItemId: game.id } }),
    ).toBe(0);
    await prisma.item.update({
      where: { id: extra.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      attachExpansions(game.id, {
        operationId: randomUUID(),
        expansions: [{ itemId: extra.id }],
      }),
    ).rejects.toMatchObject({ status: 404 });
    await prisma.item.update({
      where: { id: game.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      attachExpansions(game.id, {
        operationId: randomUUID(),
        expansions: [{ title: "New" }],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("requires a valid separate price and unambiguous expansion selection", () => {
    const common = {
      operationId: randomUUID(),
      manual: { typeId: baseTypeId, title: "Base" },
      target: "preorder",
      preorder: order,
    };
    for (const row of [
      { title: "Extra" },
      { title: "Extra", price: -1 },
      { title: "Extra", itemId: randomUUID(), price: 1 },
    ]) {
      expect(
        itemActionSchema.safeParse({ ...common, expansions: [row] }).success,
      ).toBe(false);
    }
  });
  it("searches expansions across ownership and excludes soft deleted cards", async () => {
    const extra = await expansion();
    const results = await searchLocalItems(extra.title, 1, "expansion");
    expect(results.data.map((row) => row.id)).toContain(extra.id);
    const game = await base();
    expect(
      (await searchLocalItems(game.title, 1, "expansion")).data,
    ).toHaveLength(0);
    await prisma.item.update({
      where: { id: extra.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await searchLocalItems(extra.title, 1, "expansion")).data,
    ).toHaveLength(0);
  });
});
