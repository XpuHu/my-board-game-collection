import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { getItemCard } from "@/server/application/items/item-service";
import {
  createPreorder,
  updatePreorder,
} from "@/server/application/preorders/preorder-service";
import { preorderEditRequest, preorderEditValues } from "./edit-form";
let typeId: string;
beforeAll(async () => {
  typeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
});
async function fixture() {
  const item = await prisma.item.create({
    data: { title: `Edit ${randomUUID()}`, typeId },
  });
  await createPreorder(item.id, {
    shop: "Shop",
    price: 100.25,
    currency: "RUB",
    status: "ordered",
    expectedDate: "2027-04-01",
    expectedDatePrecision: "quarter",
    trackingNumber: "TRACK",
    comment: "Original",
    orderDate: "2026-11-12",
  });
  return (await getItemCard(item.id)).preorders[0];
}
describe("preorder editing", () => {
  it("prefills dates without time shifts and sends no patch when nothing changed", async () => {
    const order = await fixture();
    const values = preorderEditValues(order);
    expect(values).toMatchObject({
      price: "100.25",
      orderDate: "2026-11-12",
      quarter: "2",
      year: "2027",
      month: "2027-04",
    });
    expect(preorderEditRequest(order, values)).toEqual({});
  });
  it("updates commercial fields and clears optional values without overwriting ownership or status", async () => {
    const order = await fixture();
    const values = {
      ...preorderEditValues(order),
      shop: "New shop",
      price: "0",
      currency: "usd",
      orderDate: "",
      trackingNumber: "",
      comment: "",
    };
    const patch = preorderEditRequest(order, values);
    expect(patch).toEqual({
      shop: "New shop",
      price: 0,
      currency: "USD",
      orderDate: null,
      trackingNumber: null,
      comment: null,
    });
    await updatePreorder(order.id, patch);
    const saved = (await getItemCard(order.item.id)).preorders[0];
    expect(saved).toMatchObject({
      shop: "New shop",
      price: { amount: 0, currency: "USD" },
      orderDate: null,
      trackingNumber: null,
      comment: null,
      status: "ordered",
    });
    expect(
      await prisma.preorderEvent.count({ where: { preorderId: order.id } }),
    ).toBe(0);
    expect((await getItemCard(order.item.id)).userItem?.owned).toBe(false);
  });
  it("records changed expected periods once and supports clearing the expected date", async () => {
    const order = await fixture();
    await updatePreorder(
      order.id,
      preorderEditRequest(order, {
        ...preorderEditValues(order),
        precision: "month",
        month: "2027-05",
      }),
    );
    const next = (await getItemCard(order.item.id)).preorders[0];
    expect(next.expectedDate).toBe("2027-05-01T00:00:00.000Z");
    expect(next.expectedDatePrecision).toBe("month");
    expect(
      await prisma.preorderEvent.count({
        where: { preorderId: order.id, type: "expected_date_changed" },
      }),
    ).toBe(1);
    await updatePreorder(
      order.id,
      preorderEditRequest(next, {
        ...preorderEditValues(next),
        precision: "unknown",
      }),
    );
    expect((await getItemCard(order.item.id)).preorders[0]).toMatchObject({
      expectedDate: null,
      expectedDatePrecision: "unknown",
    });
  });
  it("changes active progress and keeps completed orders editable without reactivation", async () => {
    const order = await fixture();
    await updatePreorder(
      order.id,
      preorderEditRequest(order, {
        ...preorderEditValues(order),
        status: "paid",
      }),
    );
    await updatePreorder(order.id, { status: "received" });
    const received = (await getItemCard(order.item.id)).preorders[0];
    await updatePreorder(
      received.id,
      preorderEditRequest(received, {
        ...preorderEditValues(received),
        price: "99.99",
      }),
    );
    const saved = (await getItemCard(order.item.id)).preorders[0];
    expect(saved.status).toBe("received");
    expect(saved.receivedDate).toBe(received.receivedDate);
    expect(saved.price.amount).toBe(99.99);
    expect(() =>
      preorderEditRequest(received, {
        ...preorderEditValues(received),
        status: "ordered",
      }),
    ).toThrow("Вернуть в активные");
  });
  it("rejects empty and negative prices, invalid currencies and impossible dates", async () => {
    const order = await fixture();
    const initial = preorderEditValues(order);
    for (const invalid of [
      { price: "" },
      { price: "-1" },
      { currency: "BAD" },
      { orderDate: "2027-02-30" },
      { precision: "day", day: "2027-02-30" },
    ]) {
      expect(() =>
        preorderEditRequest(order, { ...initial, ...invalid } as ReturnType<
          typeof preorderEditValues
        >),
      ).toThrow();
    }
  });
});
