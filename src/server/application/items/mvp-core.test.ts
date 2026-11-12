import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { executeItemAction, itemActionSchema } from "./item-action-service";
import { getItemCard } from "./item-service";
import {
  saveReferenceCommand,
  referenceCommandSchema,
} from "./reference-command";
import {
  createPreorder,
  updatePreorder,
  reactivatePreorder,
  updatePreorderExpectedDateTarget,
  deletePreorder,
} from "@/server/application/preorders/preorder-service";
let typeId: string;
beforeAll(async () => {
  typeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
});
const manual = () => ({ typeId, title: `MVP ${randomUUID()}` });
const order = {
  shop: "Shop",
  price: 100.25,
  currency: "RUB",
  status: "ordered" as const,
};
const action = (payload: Record<string, unknown>) =>
  itemActionSchema.parse({
    operationId: randomUUID(),
    target: "collection",
    ...payload,
  });
async function bare() {
  return prisma.item.create({ data: manual() });
}

describe("MVP atomic commands and neutral card", () => {
  it("replays a collection command including its purchase without duplicate records", async () => {
    const input = action({
      manual: manual(),
      collection: { purchase: { shop: "Shop", price: 42, currency: "USD" } },
    });
    const first = await executeItemAction(input);
    const second = await executeItemAction(input);
    expect(second).toEqual(first);
    expect(
      await prisma.purchase.count({ where: { itemId: first.itemId } }),
    ).toBe(1);
    expect(
      await prisma.userItem.findUnique({ where: { itemId: first.itemId } }),
    ).toMatchObject({ owned: true, wishlist: false });
    await expect(
      executeItemAction({
        ...input,
        manual: { ...input.manual!, title: "Changed" },
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
  });
  it("handles simultaneous retries with one committed item and receipt", async () => {
    const input = action({
      manual: manual(),
      target: "preorder",
      preorder: order,
    });
    const results = await Promise.all([
      executeItemAction(input),
      executeItemAction(input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      await prisma.preorder.count({ where: { itemId: results[0].itemId } }),
    ).toBe(1);
  });
  it("rolls back a newly created item when preorder normalization fails", async () => {
    const data = manual();
    const input = action({
      manual: data,
      target: "preorder",
      preorder: {
        ...order,
        expectedDate: "2026-10-01",
        expectedDatePrecision: "unknown",
      },
    });
    await expect(executeItemAction(input)).rejects.toMatchObject({
      code: "EXPECTED_DATE_MUST_BE_NULL",
    });
    expect(await prisma.item.count({ where: { title: data.title } })).toBe(0);
    expect(
      await prisma.commandReceipt.findUnique({
        where: { id: input.operationId },
      }),
    ).toBeNull();
  });
  it("reads an unowned item without creating UserItem and supports its preorder", async () => {
    const item = await bare();
    const card = await getItemCard(item.id);
    expect(card.userItem).toBeNull();
    expect(
      await prisma.userItem.findUnique({ where: { itemId: item.id } }),
    ).toBeNull();
    const created = await executeItemAction(
      action({ itemId: item.id, target: "preorder", preorder: order }),
    );
    expect((await getItemCard(item.id)).preorders[0].id).toBe(
      created.preorderId,
    );
    expect(
      await prisma.userItem.findUnique({ where: { itemId: item.id } }),
    ).toMatchObject({ owned: false, wishlist: false });
  });
  it("preserves ownership when creating another preorder", async () => {
    const item = await executeItemAction(action({ manual: manual() }));
    await executeItemAction(
      action({ itemId: item.itemId, target: "preorder", preorder: order }),
    );
    expect(
      await prisma.userItem.findUnique({ where: { itemId: item.itemId } }),
    ).toMatchObject({ owned: true, wishlist: false });
  });
  it("does not archive an item with another active preorder; receiving is repeat-safe", async () => {
    const item = await bare();
    const first = await createPreorder(item.id, order);
    const second = await createPreorder(item.id, order);
    await updatePreorder(first.id, { status: "cancelled" });
    expect(
      await prisma.userItem.findUnique({ where: { itemId: item.id } }),
    ).toMatchObject({ status: "active" });
    const received = await updatePreorder(second.id, { status: "received" });
    const ownedAt = (
      await prisma.userItem.findUniqueOrThrow({ where: { itemId: item.id } })
    ).ownedAt;
    const again = await updatePreorder(second.id, { status: "received" });
    expect(again.receivedDate).toBe(received.receivedDate);
    expect(
      again.events.filter((e) => e.type === "status_changed"),
    ).toHaveLength(1);
    expect(
      (await prisma.userItem.findUniqueOrThrow({ where: { itemId: item.id } }))
        .ownedAt,
    ).toEqual(ownedAt);
    await expect(
      updatePreorder(second.id, { status: "paid" }),
    ).rejects.toMatchObject({ code: "INVALID_PREORDER_TRANSITION" });
    await reactivatePreorder(second.id);
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: second.id } }))
        .receivedDate,
    ).toBeNull();
    expect(
      (await prisma.userItem.findUniqueOrThrow({ where: { itemId: item.id } }))
        .owned,
    ).toBe(true);
  });
  it("rejects invalid received creation and mutations of soft-deleted items", async () => {
    const item = await bare();
    await expect(
      createPreorder(item.id, { ...order, status: "received" }),
    ).rejects.toMatchObject({ code: "INVALID_PREORDER_STATE" });
    const preorder = await createPreorder(item.id, order);
    await expect(
      updatePreorder(preorder.id, { status: "received", receivedDate: null }),
    ).rejects.toMatchObject({ code: "RECEIVED_DATE_REQUIRED" });
    await prisma.item.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    await expect(getItemCard(item.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      updatePreorder(preorder.id, { status: "received" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      updatePreorderExpectedDateTarget(preorder.id, { expectedDate: null }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(reactivatePreorder(preorder.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(deletePreorder(preorder.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await prisma.preorderEvent.count({ where: { preorderId: preorder.id } }),
    ).toBe(0);
  });
  it("atomically saves resources and safely replays successful creates and deletes", async () => {
    const item = await bare();
    const input = referenceCommandSchema.parse({
      operationId: randomUUID(),
      item: { title: "Updated" },
      links: [{ data: { type: "rules", url: "https://example.com/rules" } }],
      images: [
        {
          data: {
            type: "reference",
            provider: "manual",
            url: "https://example.com/cover.jpg",
          },
        },
      ],
    });
    await saveReferenceCommand(item.id, input);
    await saveReferenceCommand(item.id, input);
    expect(await prisma.link.count({ where: { itemId: item.id } })).toBe(1);
    expect(await prisma.image.count({ where: { itemId: item.id } })).toBe(1);
    const link = await prisma.link.findFirstOrThrow({
      where: { itemId: item.id },
    });
    const deletion = referenceCommandSchema.parse({
      operationId: randomUUID(),
      item: {},
      removedLinkIds: [link.id],
    });
    await saveReferenceCommand(item.id, deletion);
    await saveReferenceCommand(item.id, deletion);
    expect(await prisma.link.count({ where: { itemId: item.id } })).toBe(0);
  });
  it("rolls back fields and resource writes when a later operation fails", async () => {
    const item = await bare();
    const input = referenceCommandSchema.parse({
      operationId: randomUUID(),
      item: { title: "Should roll back" },
      images: [{ data: { url: "https://example.com/cover.jpg" } }],
      relations: [
        {
          data: {
            relatedItemId: randomUUID(),
            direction: "child",
            relationType: "expands",
          },
        },
      ],
    });
    await expect(saveReferenceCommand(item.id, input)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).title,
    ).toBe(item.title);
    expect(await prisma.image.count({ where: { itemId: item.id } })).toBe(0);
    const userImage = await prisma.image.create({
      data: {
        itemId: item.id,
        type: "user",
        provider: "manual",
        url: "https://example.com/photo.jpg",
      },
    });
    await expect(
      saveReferenceCommand(
        item.id,
        referenceCommandSchema.parse({
          operationId: randomUUID(),
          item: {},
          removedImageIds: [userImage.id],
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await prisma.image.findUnique({ where: { id: userImage.id } }),
    ).not.toBeNull();
  });
});
