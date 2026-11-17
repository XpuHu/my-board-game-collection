import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/database/prisma";
import { PUT } from "@/app/api/preorders/[preorderId]/payments/route";
import { createPreorder, updatePreorder } from "./preorder-service";
import { exportJsonBackup, importJsonBackup } from "../backup/backup-service";
import { createPreorderRequestSchema } from "@/shared/api";
describe("payment storage and lot URL", () => {
  it("rejects invalid and unsafe lot URLs without throwing", () => {
    for (const orderUrl of [
      "not a URL",
      "javascript:alert(1)",
      "ftp://example.com",
    ]) {
      expect(
        createPreorderRequestSchema.safeParse({
          shop: "Shop",
          price: 1,
          currency: "RUB",
          status: "ordered",
          orderUrl,
        }).success,
      ).toBe(false);
    }
  });
  it("guards stale edits, preserves legacy orders, total edits and JSON restore", async () => {
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });
    const item = await prisma.item.create({
      data: { typeId: type.id, title: randomUUID() },
    });
    const preorder = await createPreorder(item.id, {
      shop: "Shop",
      price: 100,
      currency: "RUB",
      status: "ordered",
      pricingMode: "lot",
      orderUrl: "https://example.com/lot",
    });
    const context = { params: Promise.resolve({ preorderId: preorder.id }) };
    const rows = [
      { id: randomUUID(), date: "2027-01-01", amount: "30.00", paid: true },
    ];
    const request = () =>
      new Request("https://example.com", {
        method: "PUT",
        body: JSON.stringify({ rows, version: 0 }),
      });
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: preorder.id } }))
        .paymentSchedule,
    ).toBe(null);
    expect((await PUT(request(), context)).status).toBe(200);
    expect((await PUT(request(), context)).status).toBe(409);
    await updatePreorder(preorder.id, { price: 150 });
    expect(
      await prisma.preorder.findUniqueOrThrow({ where: { id: preorder.id } }),
    ).toMatchObject({
      paymentSchedule: rows,
      status: "ordered",
      orderUrl: "https://example.com/lot",
    });
    await updatePreorder(preorder.id, { fullyPaid: true, status: "shipped" });
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: preorder.id } }))
        .paymentSchedule,
    ).toEqual(rows);
    expect(
      (
        await PUT(
          new Request("https://example.com", {
            method: "PUT",
            body: JSON.stringify({ rows: [], version: 2 }),
          }),
          context,
        )
      ).status,
    ).toBe(409);
    const backup = await exportJsonBackup();
    expect(
      backup.data.preorders.find((p) => p.id === preorder.id)?.fullyPaid,
    ).toBe(true);
    expect(
      backup.data.preorders.find((p) => p.id === preorder.id)?.paymentSchedule,
    ).toEqual(rows);
    await prisma.preorder.update({
      where: { id: preorder.id },
      data: { orderUrl: null },
    });
    await importJsonBackup(backup);
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: preorder.id } }))
        .orderUrl,
    ).toBe("https://example.com/lot");
    await updatePreorder(preorder.id, { fullyPaid: false });
    expect(
      (await prisma.preorder.findUniqueOrThrow({ where: { id: preorder.id } }))
        .paymentSchedule,
    ).toEqual(rows);
  });
});
