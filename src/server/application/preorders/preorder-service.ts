import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePreorderInput,
  PaginatedResponse,
  PreorderListItemDto,
  PreorderQueryDto,
  UpdatePreorderExpectedDateResponse,
  UpdatePreorderExpectedDateInput,
} from "@/shared/api";
import type { LegacyPreorderDto } from "@/shared/api/legacy";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapPreorderEvent,
  mapPreorderListItem,
} from "@/server/application/items/item-mappers";
import { mapLegacyPreorder } from "@/server/api/legacy";
import {
  collectionTransition,
  resolveUserItemTransition,
} from "@/server/application/items/user-item-transition";

type UpdatePreorderInput = Partial<CreatePreorderInput>;

const activeStatuses = ["planned", "ordered", "paid", "shipped"];

export async function listPreorders(): Promise<LegacyPreorderDto[]> {
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
    .map((preorder) => mapLegacyPreorder(preorder, preorder.item.title));
}

export async function listPreorderItems(
  query: PreorderQueryDto,
  pagination: PaginationInput,
): Promise<PaginatedResponse<PreorderListItemDto>> {
  const where = buildPreorderWhere(query);
  const { page, pageSize } = pagination;
  const [total, preorders] = await prisma.$transaction([
    prisma.preorder.count({ where }),
    prisma.preorder.findMany({
      where,
      select: preorderListSelect,
      orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: preorders.map((preorder) => mapPreorderListItem(preorder)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function createPreorder(
  itemId: string,
  input: CreatePreorderInput,
): Promise<LegacyPreorderDto> {
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
        status: "active",
      },
      update: {},
    });

    return created;
  });

  return mapLegacyPreorder(preorder, preorder.item.title);
}

export async function updatePreorder(
  preorderId: string,
  input: UpdatePreorderInput,
): Promise<LegacyPreorderDto> {
  const existing = await getPreorderOrThrow(preorderId);
  const nextExpectedDate =
    "expectedDate" in input ? toDate(input.expectedDate) : undefined;
  const nextReceivedDate = resolveReceivedDate(existing.receivedDate, input);

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
        receivedDate: nextReceivedDate,
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
          oldValue: JSON.stringify({
            expectedDate: existing.expectedDate?.toISOString() ?? null,
            expectedDatePrecision: existing.expectedDate ? "day" : "unknown",
          }),
          newValue: JSON.stringify({
            expectedDate: nextExpectedDate?.toISOString() ?? null,
            expectedDatePrecision: nextExpectedDate ? "day" : "unknown",
          }),
        },
      });
    }

    if (input.status && input.status !== existing.status) {
      await tx.preorderEvent.create({
        data: {
          preorderId,
          type: "status_changed",
          oldValue: existing.status,
          newValue: input.status,
        },
      });
    }

    if (input.status === "received") {
      const current = await tx.userItem.findUnique({
        where: { itemId: existing.itemId },
      });
      const next = resolveUserItemTransition(current, collectionTransition());
      await tx.userItem.upsert({
        where: {
          itemId: existing.itemId,
        },
        create: {
          itemId: existing.itemId,
          ...next,
        },
        update: next,
      });
    }

    if (input.status === "cancelled") {
      const userItem = await tx.userItem.findUnique({
        where: {
          itemId: existing.itemId,
        },
      });

      if (userItem && !userItem.owned) {
        await tx.userItem.update({
          where: {
            itemId: existing.itemId,
          },
          data: {
            status: userItem.wishlist ? "active" : "archived",
          },
        });
      }
    }

    return updated;
  });

  return getPreorderDto(preorder.id);
}

export async function updatePreorderExpectedDate(
  preorderId: string,
  input: UpdatePreorderExpectedDateInput,
): Promise<LegacyPreorderDto> {
  await updatePreorderExpectedDateCommand(preorderId, input);
  return getPreorderDto(preorderId);
}

export async function updatePreorderExpectedDateTarget(
  preorderId: string,
  input: UpdatePreorderExpectedDateInput,
): Promise<UpdatePreorderExpectedDateResponse> {
  const { preorder, event, precision } = await updatePreorderExpectedDateCommand(
    preorderId,
    input,
  );
  return {
    preorder: {
      ...mapPreorderListItem(preorder),
      expectedDatePrecision: precision,
    },
    event: mapPreorderEvent(event),
  };
}

async function updatePreorderExpectedDateCommand(
  preorderId: string,
  input: UpdatePreorderExpectedDateInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.preorder.findUnique({
      where: { id: preorderId },
    });
    if (!existing) throw preorderNotFound();

    const precision = input.expectedDatePrecision ??
      (input.expectedDate ? "day" : "unknown");
    const expectedDate = normalizeExpectedDate(input.expectedDate, precision);
    const preorder = await tx.preorder.update({
      where: { id: preorderId },
      data: { expectedDate },
      select: preorderListSelect,
    });
    const event = await tx.preorderEvent.create({
      data: {
        preorderId,
        type: "expected_date_changed",
        oldValue: JSON.stringify({
          expectedDate: existing.expectedDate?.toISOString() ?? null,
          expectedDatePrecision: existing.expectedDate ? "day" : "unknown",
        }),
        newValue: JSON.stringify({
          expectedDate: expectedDate?.toISOString() ?? null,
          expectedDatePrecision: precision,
        }),
        reason: input.reason,
        comment: input.comment,
      },
    });

    return { preorder, event, precision };
  });
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

  return mapLegacyPreorder(preorder, preorder.item.title);
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

function endOfDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}

function normalizeExpectedDate(
  value: string | null,
  precision: "day" | "month" | "quarter" | "unknown",
) {
  if (!value || precision === "unknown") return null;
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  if (precision === "month") date.setUTCDate(1);
  if (precision === "quarter") {
    date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3, 1);
  }
  return date;
}

function sameDate(left?: Date | null, right?: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function resolveReceivedDate(
  existingReceivedDate: Date | null,
  input: UpdatePreorderInput,
) {
  if ("receivedDate" in input) {
    return toDate(input.receivedDate);
  }

  if (input.status === "received" && !existingReceivedDate) {
    return new Date();
  }

  return undefined;
}

function isActive(preorder: { status: string }) {
  return activeStatuses.includes(preorder.status);
}

function buildPreorderWhere(
  query: PreorderQueryDto,
): Prisma.PreorderWhereInput {
  return {
    itemId: query.itemId,
    status:
      query.group === "active"
        ? { in: activeStatuses }
        : query.group === "received"
          ? "received"
          : query.group === "cancelled"
            ? "cancelled"
            : undefined,
    expectedDate:
      query.expectedFrom || query.expectedTo
        ? {
            gte: query.expectedFrom ? new Date(query.expectedFrom) : undefined,
            lte: query.expectedTo ? endOfDay(query.expectedTo) : undefined,
          }
        : undefined,
    item: { deletedAt: null },
  };
}

const preorderInclude = {
  item: true,
  events: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.PreorderInclude;

export const preorderListSelect = {
  id: true,
  itemId: true,
  shop: true,
  price: true,
  currency: true,
  orderDate: true,
  expectedDate: true,
  receivedDate: true,
  trackingNumber: true,
  status: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  item: {
    select: {
      id: true,
      title: true,
      originalTitle: true,
      year: true,
      minPlayers: true,
      maxPlayers: true,
      minPlayTime: true,
      maxPlayTime: true,
      rating: true,
      type: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
  },
} satisfies Prisma.PreorderSelect;
