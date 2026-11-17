import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { normalizeTaxonomyName } from "../items/taxonomy-service";
import { createPreorder, updatePreorder } from "./preorder-service";

let typeId: string;
beforeAll(async () => {
  typeId = (
    await prisma.itemType.findUniqueOrThrow({ where: { code: "base_game" } })
  ).id;
});

async function fixture(shop: string) {
  const item = await prisma.item.create({
    data: { title: `Publisher preorder ${randomUUID()}`, typeId },
  });
  return createPreorder(item.id, {
    shop,
    price: 100,
    currency: "RUB",
    status: "ordered",
    pricingMode: "lot",
  });
}

describe("preorder shop publisher directory", () => {
  it("registers a new publisher when creating a preorder, preserving commas in its name", async () => {
    const name = `New Publisher, Inc. ${randomUUID()}`;
    const order = await fixture(`  ${name}  `);
    expect(order.shop).toBe(name);
    expect(
      await prisma.publisher.findUnique({
        where: { normalizedName: normalizeTaxonomyName(name) },
      }),
    ).toMatchObject({ name });
  });

  it("uses the existing publisher spelling without duplicates on creation and editing", async () => {
    const name = `Existing Publisher ${randomUUID()}`;
    const publisher = await prisma.publisher.create({
      data: { name, normalizedName: normalizeTaxonomyName(name) },
    });
    const variant = `  ${name.toUpperCase().replace(" ", "   ")}  `;
    const order = await fixture(variant);
    expect(order.shop).toBe(name);
    const other = await fixture(`Other ${randomUUID()}`);
    expect((await updatePreorder(other.id, { shop: variant })).shop).toBe(name);
    expect(
      await prisma.publisher.findMany({
        where: { normalizedName: normalizeTaxonomyName(name) },
      }),
    ).toEqual([publisher]);
  });

  it("registers a new publisher when editing and exposes it in directory search", async () => {
    const order = await fixture(`Original ${randomUUID()}`);
    const name = `Edited Publisher ${randomUUID()}`;
    expect((await updatePreorder(order.id, { shop: name })).shop).toBe(name);
    const { GET } = await import("@/app/api/publishers/route");
    const response = await GET(
      new Request(
        `http://localhost/api/publishers?q=${encodeURIComponent(name.slice(7).toUpperCase())}`,
      ),
    );
    expect(await response.json()).toEqual([expect.objectContaining({ name })]);
  });

  it("rolls back a new publisher if the preorder edit fails", async () => {
    const order = await fixture(`Original ${randomUUID()}`);
    const name = `Failed Publisher ${randomUUID()}`;
    await expect(
      updatePreorder(order.id, {
        shop: name,
        expansions: [{ itemId: randomUUID() }],
      }),
    ).rejects.toThrow();
    expect(
      await prisma.publisher.findUnique({
        where: { normalizedName: normalizeTaxonomyName(name) },
      }),
    ).toBeNull();
    expect(
      await prisma.preorder.findUnique({ where: { id: order.id } }),
    ).toMatchObject({ shop: order.shop });
  });
});
