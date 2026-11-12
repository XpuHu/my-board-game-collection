import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const Database = createRequire(import.meta.url)("better-sqlite3") as new (
  path: string,
) => {
  exec(sql: string): void;
  prepare(sql: string): { run(...args: unknown[]): unknown; get(): unknown };
  close(): void;
};
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import {
  executeItemAction,
  itemActionSchema,
} from "../items/item-action-service";
import { getItemCard } from "../items/item-service";
import { getExternalExpansionOptions } from "../items/expansion-options-service";
import {
  createPreorder,
  listPreorderItems,
  updatePreorder,
  updatePreorderExpectedDateTarget,
  reactivatePreorder,
  deletePreorder,
} from "./preorder-service";
import { exportJsonBackup, importJsonBackup } from "../backup/backup-service";
import {
  preorderEditRequest,
  preorderEditValues,
} from "@/features/preorders/edit-form";
let baseType: string;
let expansionType: string;
let accessoryType: string;
beforeAll(async () => {
  baseType = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
  expansionType = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "expansion" } })
  ).id;
  accessoryType = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "accessory" } })
  ).id;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function lot(mode: "lot" | "per_item" = "lot") {
  const base = await prisma.item.create({
    data: { typeId: baseType, title: `Base ${randomUUID()}` },
  });
  const extra = await prisma.item.create({
    data: { typeId: expansionType, title: "Expansion" },
  });
  const accessory = await prisma.item.create({
    data: { typeId: accessoryType, title: "Accessory" },
  });
  const input = itemActionSchema.parse({
    operationId: randomUUID(),
    target: "preorder",
    itemId: base.id,
    preorder: {
      shop: "Shop",
      price: 800.55,
      currency: "RUB",
      status: "paid",
      pricingMode: mode,
      paymentType: "installments",
    },
    expansions: [
      { itemId: extra.id, ...(mode === "per_item" ? { price: 100.25 } : {}) },
    ],
    accessories: [
      { itemId: accessory.id, ...(mode === "per_item" ? { price: 50.2 } : {}) },
    ],
  });
  const result = await executeItemAction(input);
  return { base, extra, accessory, input, result, id: result.preorderId! };
}
async function compact(id: string) {
  const root = await prisma.preorder.findUniqueOrThrow({ where: { id } });
  const list = await listPreorderItems(
    { group: "all", itemId: root.itemId },
    { page: 1, pageSize: 100 },
  );
  return list.data.find((row) => row.id === id)!;
}
describe("preorder lots", () => {
  it("keeps a discounted lot total without assigning invented unit prices and lists only its root", async () => {
    const created = await lot();
    const row = await compact(created.id);
    expect(row).toMatchObject({
      price: { amount: 800.55, currency: "RUB" },
      pricingMode: "lot",
      paymentType: "installments",
    });
    expect(row.children).toHaveLength(2);
    expect(
      row.children?.every(
        (child) => child.parentId === created.id && child.priceKnown === false,
      ),
    ).toBe(true);
    expect(row.children?.map((child) => child.item.type.code).sort()).toEqual([
      "accessory",
      "expansion",
    ]);
    const filtered = await listPreorderItems(
      { group: "all", itemId: created.accessory.id },
      { page: 1, pageSize: 24 },
    );
    expect(filtered.pagination.total).toBe(1);
    expect(filtered.data[0].id).toBe(created.id);
    expect(
      (await getItemCard(created.base.id)).preorders[0].children,
    ).toHaveLength(2);
    expect(await executeItemAction(created.input)).toEqual(created.result);
    expect(
      await prisma.preorder.count({ where: { parentId: created.id } }),
    ).toBe(2);
  });
  it("adds unit prices exactly once in the per-item mode", async () => {
    const created = await lot("per_item");
    const row = await compact(created.id);
    expect(row.price.amount).toBe(951);
    expect(row.basePrice).toBe(800.55);
    expect(row.children?.map((child) => child.price.amount).sort()).toEqual(
      [100.25, 50.2].sort(),
    );
    expect(row.children?.every((child) => child.priceKnown)).toBe(true);
  });
  it("receives and reactivates the entire lot without losing its composition or duplicating status events", async () => {
    const created = await lot();
    await updatePreorder(created.id, { status: "received" });
    await updatePreorder(created.id, { status: "received" });
    for (const item of [created.base, created.extra, created.accessory]) {
      expect(
        await prisma.userItem.findUnique({ where: { itemId: item.id } }),
      ).toMatchObject({ owned: true });
    }
    const row = await compact(created.id);
    expect(row.children?.every((child) => child.status === "received")).toBe(
      true,
    );
    expect(
      await prisma.preorderEvent.count({
        where: {
          preorderId: {
            in: [created.id, ...row.children!.map((child) => child.id)],
          },
          type: "status_changed",
        },
      }),
    ).toBe(3);
    await reactivatePreorder(created.id);
    expect(
      (await compact(created.id)).children?.every(
        (child) => child.status === "paid",
      ),
    ).toBe(true);
    expect((await getItemCard(created.accessory.id)).userItem?.owned).toBe(
      true,
    );
  });
  it("cancels all positions while preserving another active order for an accessory", async () => {
    const created = await lot();
    await createPreorder(created.accessory.id, {
      shop: "Another",
      price: 10,
      currency: "RUB",
      status: "ordered",
    });
    await updatePreorder(created.id, { status: "cancelled" });
    expect(
      (await compact(created.id)).children?.every(
        (child) => child.status === "cancelled",
      ),
    ).toBe(true);
    expect(
      await prisma.userItem.findUnique({
        where: { itemId: created.accessory.id },
      }),
    ).toMatchObject({ status: "active" });
    expect(
      await prisma.userItem.findUnique({ where: { itemId: created.extra.id } }),
    ).toMatchObject({ status: "archived" });
  });
  it("edits total and payment method, requires real unit prices on mode changes and applies dates to every position", async () => {
    const created = await lot();
    let row = await compact(created.id);
    await updatePreorder(
      created.id,
      preorderEditRequest(row, {
        ...preorderEditValues(row),
        price: "750",
        paymentType: "one_time",
      }),
    );
    row = await compact(created.id);
    expect(row).toMatchObject({
      price: { amount: 750 },
      paymentType: "one_time",
    });
    expect(
      row.children?.every(
        (child) => child.paymentType === "one_time" && !child.priceKnown,
      ),
    ).toBe(true);
    await expect(
      updatePreorder(created.id, { pricingMode: "per_item", price: 500 }),
    ).rejects.toMatchObject({ code: "POSITION_PRICE_REQUIRED" });
    await updatePreorder(created.id, {
      pricingMode: "per_item",
      price: 500,
      positionPrices: row.children!.map((child) => ({
        preorderId: child.id,
        price: 100,
      })),
    });
    expect((await compact(created.id)).price.amount).toBe(700);
    await updatePreorder(created.id, { pricingMode: "lot", price: 650 });
    expect((await compact(created.id)).price.amount).toBe(650);
    expect(
      (await compact(created.id)).children?.every(
        (child) => !child.priceKnown && child.price.amount === 0,
      ),
    ).toBe(true);
    await updatePreorderExpectedDateTarget(created.id, {
      expectedDate: "2027-05-01",
      expectedDatePrecision: "month",
    });
    expect(
      (await compact(created.id)).children?.every(
        (child) => child.expectedDate === "2027-05-01T00:00:00.000Z",
      ),
    ).toBe(true);
  });
  it("rolls back all cards and orders when a later accessory is missing", async () => {
    const title = `Rollback ${randomUUID()}`;
    const input = itemActionSchema.parse({
      operationId: randomUUID(),
      manual: { title, typeId: baseType },
      target: "preorder",
      preorder: {
        shop: "Shop",
        price: 200,
        currency: "RUB",
        status: "ordered",
        pricingMode: "lot",
      },
      expansions: [{ title: `Expansion ${title}` }],
      accessories: [{ itemId: randomUUID() }],
    });
    await expect(executeItemAction(input)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await prisma.item.count({ where: { title: { contains: title } } }),
    ).toBe(0);
  });
  it("loads and imports accessory options from the API, then replays without a provider call", async () => {
    vi.stubEnv("EXTERNAL_PROVIDERS_ENABLED", "true");
    const externalId = String(Date.now());
    const metadata = {
      provider: "boardgamegeek" as const,
      externalId,
      title: "API accessory",
      itemTypeCode: "accessory" as const,
      categories: [],
      mechanics: [],
      designers: [],
      artists: [],
      publishers: [],
    };
    const related = vi
      .spyOn(boardGameGeekProvider, "getRelatedItems")
      .mockResolvedValue([metadata]);
    expect(
      (
        await getExternalExpansionOptions(
          { provider: "boardgamegeek", externalId: "13" },
          "accessory",
        )
      ).data[0].external?.externalId,
    ).toBe(externalId);
    expect(related).toHaveBeenCalledWith("13", "accessory");
    const details = vi
      .spyOn(boardGameGeekProvider, "getItem")
      .mockResolvedValue(metadata);
    const input = itemActionSchema.parse({
      operationId: randomUUID(),
      manual: { typeId: baseType, title: "With API accessory" },
      target: "preorder",
      preorder: {
        shop: "Shop",
        price: 100,
        currency: "RUB",
        status: "ordered",
        pricingMode: "lot",
      },
      accessories: [{ external: { provider: "boardgamegeek", externalId } }],
    });
    const result = await executeItemAction(input);
    expect(
      (await compact(result.preorderId!)).children?.[0].item.type.code,
    ).toBe("accessory");
    details.mockRejectedValue(new Error("Offline"));
    expect(await executeItemAction(input)).toEqual(result);
    expect(details).toHaveBeenCalledTimes(1);
  });
  it("preserves lot composition and payment details through JSON backup restore", async () => {
    const created = await lot();
    const backup = await exportJsonBackup();
    await prisma.preorder.updateMany({
      where: { parentId: created.id },
      data: { parentId: null, priceKnown: true },
    });
    await prisma.preorder.update({
      where: { id: created.id },
      data: { pricingMode: "per_item", paymentType: "one_time" },
    });
    await importJsonBackup(backup);
    const restored = await compact(created.id);
    expect(restored).toMatchObject({
      pricingMode: "lot",
      paymentType: "installments",
    });
    expect(restored.children).toHaveLength(2);
    expect(restored.children?.every((child) => !child.priceKnown)).toBe(true);
  });
  it("deletes the lot and child orders together but keeps the game cards", async () => {
    const created = await lot();
    await deletePreorder(created.id);
    expect(
      await prisma.preorder.count({
        where: { OR: [{ id: created.id }, { parentId: created.id }] },
      }),
    ).toBe(0);
    expect(
      await prisma.item.findUnique({ where: { id: created.accessory.id } }),
    ).not.toBeNull();
  });
  it("prevents individual mutations from breaking the lot price and composition", async () => {
    const created = await lot();
    const childId = (await compact(created.id)).children![0].id;
    await expect(updatePreorder(childId, { price: 50 })).rejects.toMatchObject({
      code: "EDIT_LOT",
    });
    await expect(deletePreorder(childId)).rejects.toMatchObject({
      code: "EDIT_LOT",
    });
    await expect(
      updatePreorderExpectedDateTarget(childId, {
        expectedDate: null,
        expectedDatePrecision: "unknown",
      }),
    ).rejects.toMatchObject({ code: "EDIT_LOT" });
    expect((await compact(created.id)).price.amount).toBe(800.55);
  });
  it("migrates old expansion orders using saved command receipts without changing monetary values", () => {
    const db = new Database(":memory:");
    try {
      db.exec(
        "CREATE TABLE preorders (id TEXT PRIMARY KEY, price DECIMAL); CREATE TABLE command_receipts (kind TEXT, result TEXT);",
      );
      db.prepare("INSERT INTO preorders (id, price) VALUES (?, ?)").run(
        "root",
        500,
      );
      db.prepare("INSERT INTO preorders (id, price) VALUES (?, ?)").run(
        "child",
        100,
      );
      db.prepare("INSERT INTO preorders (id, price) VALUES (?, ?)").run(
        "independent",
        200,
      );
      db.prepare(
        "INSERT INTO command_receipts (kind, result) VALUES (?, ?)",
      ).run(
        "item-action",
        JSON.stringify({ preorderId: "root", expansionPreorderIds: ["child"] }),
      );
      db.exec(
        readFileSync(
          "prisma/migrations/20261112190000_preorder_lots/migration.sql",
          "utf8",
        ),
      );
      expect(
        db
          .prepare(
            "SELECT parent_id, price, payment_type FROM preorders WHERE id = 'child'",
          )
          .get(),
      ).toEqual({ parent_id: "root", price: 100, payment_type: "unspecified" });
      expect(
        db
          .prepare(
            "SELECT parent_id, price FROM preorders WHERE id = 'independent'",
          )
          .get(),
      ).toEqual({ parent_id: null, price: 200 });
    } finally {
      db.close();
    }
  });
});
