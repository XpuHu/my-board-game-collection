import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { createPreorderRequestSchema } from "@/shared/api";
import { preorderTotal } from "@/shared/lib/preorder-delivery";
import { paymentSummary } from "@/shared/lib/payment-schedule";
import {
  executeItemAction,
  itemActionSchema,
} from "../items/item-action-service";
import { getItemCard } from "../items/item-service";
import { createPreorder, updatePreorder } from "./preorder-service";
import {
  preorderEditRequest,
  preorderEditValues,
} from "@/features/preorders/edit-form";
import { exportJsonBackup, importJsonBackup } from "../backup/backup-service";

let typeId: string;
beforeAll(async () => {
  typeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
});
const base = () =>
  prisma.item.create({ data: { title: `Delivery ${randomUUID()}`, typeId } });
const common = {
  shop: "Delivery shop",
  price: 100.25,
  currency: "RUB",
  status: "ordered" as const,
};

describe("preorder delivery", () => {
  it("allows omitted, unknown and free delivery, but rejects negative costs and unsupported methods", () => {
    for (const deliveryCost of [undefined, null, 0, 15.25])
      expect(
        createPreorderRequestSchema.safeParse({ ...common, deliveryCost })
          .success,
      ).toBe(true);
    for (const deliveryCost of [-1, NaN, Infinity])
      expect(
        createPreorderRequestSchema.safeParse({ ...common, deliveryCost })
          .success,
      ).toBe(false);
    expect(
      createPreorderRequestSchema.safeParse({
        ...common,
        deliveryMethod: "courier",
      }).success,
    ).toBe(false);
  });

  it("charges delivery once for the root lot and includes it in the payment balance", async () => {
    const game = await base();
    await executeItemAction(
      itemActionSchema.parse({
        operationId: randomUUID(),
        target: "preorder",
        itemId: game.id,
        preorder: {
          ...common,
          pricingMode: "per_item",
          deliveryMethod: "pickup_point",
          deliveryCost: 30.2,
        },
        expansions: [{ title: `Extra ${randomUUID()}`, price: 20.5 }],
      }),
    );
    const order = (await getItemCard(game.id)).preorders[0];
    expect(order).toMatchObject({
      deliveryMethod: "pickup_point",
      deliveryCost: 30.2,
      price: { amount: 120.75 },
      basePrice: 100.25,
    });
    expect(order.children?.[0]).toMatchObject({
      deliveryMethod: "unspecified",
      deliveryCost: null,
    });
    expect(preorderTotal(order)).toBe(150.95);
    expect(
      paymentSummary(preorderTotal(order).toFixed(2), [
        { id: randomUUID(), date: "2027-01-01", amount: "120.75", paid: true },
      ]),
    ).toMatchObject({ state: "partial", remaining: "30.20" });
  });

  it("prefills delivery, updates it without changing lot prices and distinguishes free from unknown", async () => {
    const game = await base();
    await createPreorder(game.id, {
      ...common,
      deliveryMethod: "pickup_point",
      deliveryCost: 15.25,
    });
    let order = (await getItemCard(game.id)).preorders[0];
    expect(preorderEditValues(order)).toMatchObject({
      deliveryMethod: "pickup_point",
      deliveryCost: "15.25",
    });
    expect(preorderEditRequest(order, preorderEditValues(order))).toEqual({});
    const patch = preorderEditRequest(order, {
      ...preorderEditValues(order),
      deliveryMethod: "pickup",
      deliveryCost: "0",
    });
    expect(patch).toEqual({ deliveryMethod: "pickup", deliveryCost: 0 });
    await updatePreorder(order.id, patch);
    order = (await getItemCard(game.id)).preorders[0];
    expect(order).toMatchObject({
      deliveryCost: 0,
      deliveryMethod: "pickup",
      price: { amount: 100.25 },
    });
    expect(preorderEditValues(order).deliveryCost).toBe("0");
    await updatePreorder(
      order.id,
      preorderEditRequest(order, {
        ...preorderEditValues(order),
        deliveryCost: "",
      }),
    );
    expect((await getItemCard(game.id)).preorders[0].deliveryCost).toBeNull();
  });

  it("preserves delivery in backup restore and accepts backups made before delivery fields existed", async () => {
    const game = await base();
    const created = await createPreorder(game.id, {
      ...common,
      deliveryMethod: "pickup_point",
      deliveryCost: 15.25,
    });
    const backup = await exportJsonBackup();
    expect(
      backup.data.preorders.find(({ id }) => id === created.id),
    ).toMatchObject({ deliveryMethod: "pickup_point", deliveryCost: 15.25 });
    await updatePreorder(created.id, {
      deliveryMethod: "pickup",
      deliveryCost: 0,
    });
    await importJsonBackup(backup);
    expect((await getItemCard(game.id)).preorders[0]).toMatchObject({
      deliveryMethod: "pickup_point",
      deliveryCost: 15.25,
    });
    for (const order of backup.data.preorders) {
      delete order.deliveryMethod;
      delete order.deliveryCost;
    }
    await prisma.preorder.delete({ where: { id: created.id } });
    await importJsonBackup(backup);
    expect((await getItemCard(game.id)).preorders[0]).toMatchObject({
      deliveryMethod: "unspecified",
      deliveryCost: null,
    });
  });

  it("adds currency amounts without binary rounding noise", () => {
    expect(preorderTotal({ price: { amount: 0.1 }, deliveryCost: 0.2 })).toBe(
      0.3,
    );
    expect(preorderTotal({ price: { amount: 100 }, deliveryCost: null })).toBe(
      100,
    );
  });
});
