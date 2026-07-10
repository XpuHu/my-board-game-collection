import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePurchaseInput,
  PurchaseDto,
  UpdatePurchaseInput,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";
import { mapPurchase } from "@/server/application/items/item-mappers";

export async function listPurchases(): Promise<PurchaseDto[]> {
  const purchases = await prisma.purchase.findMany({
    where: {
      item: {
        deletedAt: null,
      },
    },
    orderBy: [
      {
        purchaseDate: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return purchases.map(mapPurchase);
}

export async function createPurchase(
  itemId: string,
  input: CreatePurchaseInput,
): Promise<PurchaseDto> {
  await assertItemExists(itemId);

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        itemId,
        shop: input.shop,
        price: input.price,
        currency: input.currency,
        deliveryCost: input.deliveryCost,
        discount: input.discount,
        totalPrice: resolveTotalPrice(input),
        purchaseDate: toDate(input.purchaseDate),
        comment: input.comment,
      },
    });

    await tx.userItem.upsert({
      where: {
        itemId,
      },
      create: {
        itemId,
        owned: true,
        wishlist: false,
        status: "owned",
      },
      update: {
        owned: true,
        status: "owned",
      },
    });

    return created;
  });

  return mapPurchase(purchase);
}

export async function updatePurchase(
  purchaseId: string,
  input: UpdatePurchaseInput,
): Promise<PurchaseDto> {
  const existing = await getPurchaseOrThrow(purchaseId);
  const price = input.price ?? Number(existing.price);
  const deliveryCost =
    "deliveryCost" in input
      ? input.deliveryCost
      : nullableDecimalToNumber(existing.deliveryCost);
  const discount =
    "discount" in input ? input.discount : nullableDecimalToNumber(existing.discount);

  const purchase = await prisma.purchase.update({
    where: {
      id: purchaseId,
    },
    data: {
      shop: input.shop,
      price: input.price,
      currency: input.currency,
      deliveryCost: input.deliveryCost,
      discount: input.discount,
      totalPrice:
        input.totalPrice ??
        ("price" in input || "deliveryCost" in input || "discount" in input
          ? price + (deliveryCost ?? 0) - (discount ?? 0)
          : undefined),
      purchaseDate:
        "purchaseDate" in input ? toDate(input.purchaseDate) : undefined,
      comment: input.comment,
    },
  });

  return mapPurchase(purchase);
}

export async function deletePurchase(purchaseId: string) {
  await getPurchaseOrThrow(purchaseId);

  await prisma.purchase.delete({
    where: {
      id: purchaseId,
    },
  });
}

async function getPurchaseOrThrow(purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: {
      id: purchaseId,
    },
  });

  if (!purchase) {
    throw ApiError.notFound("PURCHASE_NOT_FOUND", "Purchase was not found");
  }

  return purchase;
}

async function assertItemExists(itemId: string) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  }
}

function resolveTotalPrice(input: CreatePurchaseInput) {
  return (
    input.totalPrice ??
    input.price + (input.deliveryCost ?? 0) - (input.discount ?? 0)
  );
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function nullableDecimalToNumber(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}
