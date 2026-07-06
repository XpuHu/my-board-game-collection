import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePreorderInput,
  PreorderDto,
  UpdatePreorderExpectedDateInput,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";
import { mapPreorder } from "@/server/application/items/item-mappers";

type UpdatePreorderInput = Partial<CreatePreorderInput>;

const activeStatuses = ["planned", "ordered", "paid", "shipped"];

export async function listPreorders(): Promise<PreorderDto[]> {
  const preorders = await prisma.preorder.findMany({
    where: {
      item: {
        deletedAt: null,
      },
    },
    include: preorderInclude,
    orderBy: [
      {
        expectedDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return preorders
    .sort((left, right) => Number(isActive(right)) - Number(isActive(left)))
    .map((preorder) => mapPreorder(preorder, preorder.item.title));
}

export async function createPreorder(
  itemId: string,
  input: CreatePreorderInput,
): Promise<PreorderDto> {
  await assertItemExists(itemId);

  const preorder = await prisma.$transaction(async (tx) => {
    const created = await tx.preorder.create({
      data: {
        itemId,
        shop: input.shop,
        price: input.price,
        currency: input.currency,
        orderDate: toDate(input.orderDate),
        expectedDate: toDate(input.expectedDate),
        receivedDate: toDate(input.receivedDate),
        trackingNumber: input.trackingNumber,
        status: input.status,
        comment: input.comment,
      },
      include: preorderInclude,
    });

    await tx.userItem.upsert({
      where: {
        itemId,
      },
      create: {
        itemId,
        owned: false,
        wishlist: false,
        status: "preordered",
      },
      update: {
        status: "preordered",
      },
    });

    return created;
  });

  return mapPreorder(preorder, preorder.item.title);
}

export async function updatePreorder(
  preorderId: string,
  input: UpdatePreorderInput,
): Promise<PreorderDto> {
  const existing = await getPreorderOrThrow(preorderId);
  const nextExpectedDate =
    "expectedDate" in input ? toDate(input.expectedDate) : undefined;

  const preorder = await prisma.$transaction(async (tx) => {
    const updated = await tx.preorder.update({
      where: {
        id: preorderId,
      },
      data: {
        shop: input.shop,
        price: input.price,
        currency: input.currency,
        orderDate: "orderDate" in input ? toDate(input.orderDate) : undefined,
        expectedDate: nextExpectedDate,
        receivedDate:
          "receivedDate" in input ? toDate(input.receivedDate) : undefined,
        trackingNumber: input.trackingNumber,
        status: input.status,
        comment: input.comment,
      },
      include: preorderInclude,
    });

    if (
      "expectedDate" in input &&
      !sameDate(existing.expectedDate, nextExpectedDate)
    ) {
      await tx.preorderEvent.create({
        data: {
          preorderId,
          type: "expected_date_changed",
          oldValue: existing.expectedDate?.toISOString() ?? null,
          newValue: nextExpectedDate?.toISOString() ?? null,
        },
      });
    }

    return updated;
  });

  return getPreorderDto(preorder.id);
}

export async function updatePreorderExpectedDate(
  preorderId: string,
  input: UpdatePreorderExpectedDateInput,
): Promise<PreorderDto> {
  const existing = await getPreorderOrThrow(preorderId);
  const expectedDate = toDate(input.expectedDate);

  await prisma.$transaction(async (tx) => {
    await tx.preorder.update({
      where: {
        id: preorderId,
      },
      data: {
        expectedDate,
      },
    });

    await tx.preorderEvent.create({
      data: {
        preorderId,
        type: "expected_date_changed",
        oldValue: existing.expectedDate?.toISOString() ?? null,
        newValue: expectedDate?.toISOString() ?? null,
        reason: input.reason,
        comment: input.comment,
      },
    });
  });

  return getPreorderDto(preorderId);
}

export async function deletePreorder(preorderId: string) {
  await getPreorderOrThrow(preorderId);

  await prisma.preorder.delete({
    where: {
      id: preorderId,
    },
  });
}

async function getPreorderDto(preorderId: string) {
  const preorder = await prisma.preorder.findUnique({
    where: {
      id: preorderId,
    },
    include: preorderInclude,
  });

  if (!preorder) {
    throw preorderNotFound();
  }

  return mapPreorder(preorder, preorder.item.title);
}

async function getPreorderOrThrow(preorderId: string) {
  const preorder = await prisma.preorder.findUnique({
    where: {
      id: preorderId,
    },
  });

  if (!preorder) {
    throw preorderNotFound();
  }

  return preorder;
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

function preorderNotFound() {
  return ApiError.notFound("PREORDER_NOT_FOUND", "Preorder was not found");
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function sameDate(left?: Date | null, right?: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function isActive(preorder: { status: string }) {
  return activeStatuses.includes(preorder.status);
}

const preorderInclude = {
  item: true,
  events: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.PreorderInclude;
