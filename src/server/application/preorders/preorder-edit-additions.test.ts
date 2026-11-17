import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { createPreorder, updatePreorder } from "./preorder-service";
import { getItemCard } from "../items/item-service";
import {
  preorderEditRequest,
  preorderEditValues,
} from "@/features/preorders/edit-form";
import { updatePreorderRequestSchema } from "@/shared/api";
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function fixture(mode: "lot" | "per_item" = "lot") {
  const game = await prisma.item.create({
    data: { typeId: baseType, title: `Base ${randomUUID()}` },
  });
  await createPreorder(game.id, {
    shop: "Old shop",
    price: 100,
    currency: "RUB",
    status: "paid",
    pricingMode: mode,
    paymentType: "installments",
    expectedDate: "2027-04-01",
    expectedDatePrecision: "month",
  });
  return (await getItemCard(game.id)).preorders[0];
}
async function extra() {
  return prisma.item.create({
    data: { typeId: expansionType, title: `Extra ${randomUUID()}` },
  });
}
describe("adding expansions while editing a preorder", () => {
  it("adds existing and new accessories, includes per-item prices and safely replays", async () => {
    const order = await fixture("per_item");
    const accessoryType = await prisma.itemType.findUniqueOrThrow({
      where: { code: "accessory" },
    });
    const accessory = await prisma.item.create({
      data: { typeId: accessoryType.id, title: `Accessory ${randomUUID()}` },
    });
    const input = {
      operationId: randomUUID(),
      accessories: [
        { itemId: accessory.id, price: 20 },
        { title: `Sleeves ${randomUUID()}`, price: 5 },
      ],
    };
    const first = await updatePreorder(order.id, input);
    expect(await updatePreorder(order.id, input)).toEqual(first);
    const row = (await getItemCard(order.item.id)).preorders[0];
    expect(row.children).toHaveLength(2);
    expect(
      row.children!.every((child) => child.item.type.code === "accessory"),
    ).toBe(true);
    expect(row.price.amount).toBe(125);
    await expect(
      updatePreorder(order.id, {
        operationId: randomUUID(),
        accessories: [{ itemId: accessory.id, price: 20 }],
      }),
    ).rejects.toMatchObject({ code: "POSITION_ALREADY_IN_LOT" });
  });
  it("saves changes and an existing expansion atomically, inherits common data and replays without duplicates", async () => {
    const order = await fixture();
    const item = await extra();
    const patch = {
      operationId: randomUUID(),
      ...preorderEditRequest(
        order,
        { ...preorderEditValues(order), price: "90", shop: "New shop" },
        [{ itemId: item.id }],
      ),
    };
    const result = await updatePreorder(order.id, patch);
    expect(await updatePreorder(order.id, patch)).toEqual(result);
    const row = (await getItemCard(order.item.id)).preorders[0];
    expect(row).toMatchObject({ shop: "New shop", price: { amount: 90 } });
    expect(row.children).toHaveLength(1);
    expect(row.children![0]).toMatchObject({
      shop: "New shop",
      paymentType: "installments",
      status: "paid",
      priceKnown: false,
      expectedDate: "2027-04-01T00:00:00.000Z",
    });
    await expect(
      updatePreorder(order.id, { ...patch, price: 200 }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
  });
  it("creates a new expansion only once and requires individual prices in the per-item mode", async () => {
    const order = await fixture("per_item");
    const operationId = randomUUID();
    const title = `New ${randomUUID()}`;
    await expect(
      updatePreorder(order.id, { operationId, expansions: [{ title }] }),
    ).rejects.toMatchObject({ code: "POSITION_PRICE_REQUIRED" });
    const input = { operationId, expansions: [{ title, price: 25.5 }] };
    await updatePreorder(order.id, input);
    await updatePreorder(order.id, input);
    expect(await prisma.item.count({ where: { title } })).toBe(1);
    const row = (await getItemCard(order.item.id)).preorders[0];
    expect(row.price.amount).toBe(125.5);
    expect(row.children?.[0].priceKnown).toBe(true);
  });
  it("rolls back field edits and all newly created cards if a later expansion is unavailable", async () => {
    const order = await fixture();
    const title = `Rollback ${randomUUID()}`;
    await expect(
      updatePreorder(order.id, {
        operationId: randomUUID(),
        shop: "Should roll back",
        price: 80,
        expansions: [{ title }, { itemId: randomUUID() }],
      }),
    ).rejects.toMatchObject({ status: 404 });
    const row = (await getItemCard(order.item.id)).preorders[0];
    expect(row.shop).toBe("Old shop");
    expect(row.price.amount).toBe(100);
    expect(row.children).toHaveLength(0);
    expect(await prisma.item.count({ where: { title } })).toBe(0);
  });
  it("rejects a duplicate already in the lot and leaves other edits unchanged", async () => {
    const order = await fixture();
    const item = await extra();
    await updatePreorder(order.id, {
      operationId: randomUUID(),
      expansions: [{ itemId: item.id }],
    });
    await expect(
      updatePreorder(order.id, {
        operationId: randomUUID(),
        price: 1,
        expansions: [{ itemId: item.id }],
      }),
    ).rejects.toMatchObject({ code: "POSITION_ALREADY_IN_LOT" });
    const row = (await getItemCard(order.item.id)).preorders[0];
    expect(row.price.amount).toBe(100);
    expect(row.children).toHaveLength(1);
  });
  it("imports an API expansion and can replay after the provider becomes unavailable", async () => {
    vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
    const order = await fixture();
    const externalId = String(Date.now());
    const provider = vi
      .spyOn(boardGameGeekProvider, "getItem")
      .mockResolvedValue({
        provider: "boardgamegeek",
        externalId,
        title: "API expansion",
        itemTypeCode: "expansion",
        categories: [],
        mechanics: [],
        designers: [],
        artists: [],
        publishers: [],
      });
    const input = {
      operationId: randomUUID(),
      expansions: [
        { external: { provider: "boardgamegeek" as const, externalId } },
      ],
    };
    const result = await updatePreorder(order.id, input);
    provider.mockRejectedValue(new Error("Offline"));
    expect(await updatePreorder(order.id, input)).toEqual(result);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(
      (await getItemCard(order.item.id)).preorders[0].children,
    ).toHaveLength(1);
  });
  it("adds expansions to received and cancelled orders with the matching ownership and status", async () => {
    for (const status of ["received", "cancelled"] as const) {
      const order = await fixture();
      await updatePreorder(order.id, { status });
      const item = await extra();
      await updatePreorder(order.id, {
        operationId: randomUUID(),
        expansions: [{ itemId: item.id }],
      });
      const child = (await getItemCard(order.item.id)).preorders[0]
        .children![0];
      expect(child.status).toBe(status);
      const userItem = await prisma.userItem.findUniqueOrThrow({
        where: { itemId: item.id },
      });
      expect(userItem.owned).toBe(status === "received");
      if (status === "cancelled") expect(userItem.status).toBe("archived");
    }
  });
  it("requires a stable operation identifier when adding positions", () => {
    expect(
      updatePreorderRequestSchema.safeParse({ expansions: [{ title: "New" }] })
        .success,
    ).toBe(false);
  });
});
