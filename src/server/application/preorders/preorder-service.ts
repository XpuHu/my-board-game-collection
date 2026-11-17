import { updatePreorderRequestSchema } from "@/shared/api";
import { receivePreorderLot } from "./receive-preorder";
import { ensurePublisher } from "@/server/application/items/taxonomy-service";
import { runCommand } from "@/server/application/items/command-receipt";
import {
  linkExpansionsInTransaction,
  prepareExpansionImports,
  type ExpansionSelection,
} from "@/server/application/items/expansion-service";
import { Prisma, type Preorder } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePreorderInput,
  UpdatePreorderRequest,
  ExpectedDatePrecision,
  PaginatedResponse,
  PreorderListItemDto,
  PreorderQueryDto,
  PreorderStatus,
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

type UpdatePreorderInput = Partial<CreatePreorderInput> & {
  operationId?: string;
  expansions?: ExpansionSelection[];
  accessories?: ExpansionSelection[];
  positionPrices?: { preorderId: string; price: number }[];
};

const activeStatuses = [
  "planned",
  "ordered",
  "paid",
  "shipped",
] satisfies PreorderStatus[];

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
        expectedDate: { sort: "asc", nulls: "first" },
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
  now = new Date(),
): Promise<PaginatedResponse<PreorderListItemDto>> {
  const where = buildPreorderWhere(query);
  const { page, pageSize } = pagination;
  const [total, preorders] = await prisma.$transaction([
    prisma.preorder.count({ where }),
    prisma.preorder.findMany({
      where,
      select: preorderLotSelect,
      orderBy: [
        { expectedDate: { sort: "asc", nulls: "first" } },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: preorders.map((preorder) => mapPreorderListItem(preorder, now)),
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
  const preorder = await prisma.$transaction((tx) =>
    createPreorderInTransaction(tx, itemId, input),
  );
  return mapLegacyPreorder(preorder, preorder.item.title);
}

export async function createPreorderInTransaction(
  tx: Prisma.TransactionClient,
  itemId: string,
  input: CreatePreorderInput,
  group?: { parentId: string; priceKnown: boolean },
) {
  const item = await tx.item.findFirst({
    where: { id: itemId, deletedAt: null },
  });
  if (!item) throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  if (!isActiveStatus(input.status) || input.receivedDate)
    throw ApiError.badRequest(
      "INVALID_PREORDER_STATE",
      "Create an active preorder without a received date",
    );
  const expected = resolveExpectedDate(
    input.expectedDate,
    input.expectedDatePrecision,
  );
  // Lot positions inherit the already registered, canonical shop of the root.
  const shop = group
    ? input.shop
    : (await ensurePublisher(tx, input.shop)).name;
  const created = await tx.preorder.create({
    data: {
      itemId,
      parentId: group?.parentId,
      priceKnown: group?.priceKnown ?? true,
      pricingMode: input.pricingMode ?? "per_item",
      fullyPaid: input.fullyPaid ?? (input.status === "paid" ? true : null),
      paymentType: input.paymentType ?? "unspecified",
      shop,
      price: input.price,
      currency: input.currency,
      orderDate: toDate(input.orderDate),
      expectedDate: expected.date,
      expectedDatePrecision: expected.precision,
      receivedDate: null,
      orderUrl: input.orderUrl,
      deliveryMethod: group ? "unspecified" : input.deliveryMethod,
      deliveryCost: group ? null : input.deliveryCost,
      trackingNumber: input.trackingNumber,
      status: input.status,
      comment: input.comment,
    },
    include: preorderInclude,
  });
  const current = await tx.userItem.findUnique({ where: { itemId } });
  await tx.userItem.upsert({
    where: { itemId },
    create: { itemId, owned: false, wishlist: false, status: "active" },
    update: !current?.owned ? { status: "active" } : {},
  });
  return created;
}

export async function createPreorderPositionsInTransaction(
  tx: Prisma.TransactionClient,
  root: Preorder,
  positions: { itemId: string; price?: number }[],
) {
  if (!positions.length) return [];
  const lot = root.pricingMode === "lot";
  const created = await tx.preorder.createManyAndReturn({
    data: positions.map(({ itemId, price }) => ({
      itemId,
      parentId: root.id,
      shop: root.shop,
      price: lot ? 0 : price!,
      priceKnown: !lot,
      currency: root.currency,
      pricingMode: root.pricingMode,
      fullyPaid: root.fullyPaid,
      paymentType: root.paymentType,
      orderDate: root.orderDate,
      expectedDate: root.expectedDate,
      expectedDatePrecision: root.expectedDatePrecision,
      receivedDate: null,
      orderUrl: root.orderUrl,
      trackingNumber: root.trackingNumber,
      status: root.status,
      comment: root.comment,
    })),
    select: { id: true, itemId: true },
  });
  const ids = positions.map(({ itemId }) => itemId);
  await tx.userItem.createMany({
    data: ids.map((itemId) => ({
      itemId,
      owned: false,
      wishlist: false,
      status: "active",
    })),
    skipDuplicates: true,
  });
  await tx.userItem.updateMany({
    where: { itemId: { in: ids }, owned: false },
    data: { status: "active" },
  });
  // INSERT RETURNING does not guarantee the selection order.
  const byItem = new Map(
    created.map((position) => [position.itemId, position]),
  );
  return positions.map(({ itemId }) => byItem.get(itemId)!);
}

export async function updatePreorder(
  preorderId: string,
  input: UpdatePreorderRequest,
): Promise<LegacyPreorderDto> {
  const { operationId, ...payload } = updatePreorderRequestSchema.parse(input);
  if (!operationId) return changePreorder(preorderId, payload, false);
  let prepared: Awaited<ReturnType<typeof prepareExpansionImports>> = new Map();
  let preparedAccessories: Awaited<ReturnType<typeof prepareExpansionImports>> =
    new Map();
  return runCommand(
    operationId,
    "edit-preorder",
    { preorderId, ...payload },
    async (tx) => {
      const updated = await changePreorderInTransaction(
        tx,
        preorderId,
        payload,
        false,
        prepared,
        preparedAccessories,
      );
      return mapLegacyPreorder(updated, updated.item.title);
    },
    [...(payload.expansions ?? []), ...(payload.accessories ?? [])].some(
      (item) => item.external,
    )
      ? async () => {
          prepared = await prepareExpansionImports(payload.expansions ?? []);
          preparedAccessories = await prepareExpansionImports(
            payload.accessories ?? [],
            "accessory",
          );
        }
      : undefined,
  );
}
export async function reactivatePreorder(
  preorderId: string,
): Promise<LegacyPreorderDto> {
  return changePreorder(preorderId, {}, true);
}
async function changePreorder(
  preorderId: string,
  request: UpdatePreorderInput,
  reactivate: boolean,
) {
  const updated = await prisma.$transaction(
    (tx) => changePreorderInTransaction(tx, preorderId, request, reactivate),
    { timeout: 30_000 },
  );
  return mapLegacyPreorder(updated, updated.item.title);
}
async function changePreorderInTransaction(
  tx: Prisma.TransactionClient,
  preorderId: string,
  request: UpdatePreorderInput,
  reactivate: boolean,
  prepared: Awaited<ReturnType<typeof prepareExpansionImports>> = new Map(),
  preparedAccessories: Awaited<
    ReturnType<typeof prepareExpansionImports>
  > = new Map(),
) {
  const receivingOnly =
    !reactivate &&
    (request.status === "received" ||
      (request.status === undefined && request.receivedDate !== undefined)) &&
    Object.keys(request).every(
      (key) => key === "status" || key === "receivedDate",
    );
  if (receivingOnly) {
    // Serialize retries before reading the lot, so concurrent clicks cannot
    // duplicate receipt events. Explicit date corrections remain supported.
    const locked = await tx.preorder.updateMany({
      where: { id: preorderId },
      data: { updatedAt: new Date() },
    });
    if (!locked.count) throw preorderNotFound();
  }
  const existing = await tx.preorder.findFirst({
    where: { id: preorderId, item: { deletedAt: null } },
    include: { children: { where: { item: { deletedAt: null } } } },
  });
  if (!existing) throw preorderNotFound();
  if (existing.parentId)
    throw ApiError.conflict(
      "EDIT_LOT",
      "Позиция входит в лот. Измените предзаказ основной игры.",
    );
  if (receivingOnly) {
    if (request.status === undefined && existing.status !== "received")
      throw ApiError.badRequest(
        "INVALID_RECEIVED_DATE",
        "Only received preorders have a received date",
      );
    await receivePreorderLot(tx, existing, request.receivedDate);
    return tx.preorder.findUniqueOrThrow({
      where: { id: preorderId },
      include: preorderInclude,
    });
  }
  if (
    existing.paymentSchedule &&
    request.currency &&
    request.currency !== existing.currency
  )
    throw ApiError.conflict(
      "PAYMENT_CURRENCY",
      "Remove the payment schedule before changing currency.",
    );
  const {
    positionPrices,
    expansions = [],
    accessories = [],
    ...rootRequest
  } = request;
  const childPrices = new Map(
    (positionPrices ?? []).map((position) => [
      position.preorderId,
      position.price,
    ]),
  );
  if (
    childPrices.size !== (positionPrices?.length ?? 0) ||
    [...childPrices.keys()].some(
      (id) => !existing.children.some((child) => child.id === id),
    )
  )
    throw ApiError.badRequest(
      "INVALID_POSITION",
      "Позиция не входит в этот лот",
    );
  const mode = rootRequest.pricingMode ?? existing.pricingMode;
  if (
    mode === "per_item" &&
    existing.children.some(
      (child) => !child.priceKnown && !childPrices.has(child.id),
    )
  )
    throw ApiError.badRequest(
      "POSITION_PRICE_REQUIRED",
      "Укажите стоимость каждой позиции для режима цен по позициям",
    );
  const result = await applyPreorderChange(
    tx,
    existing,
    rootRequest,
    reactivate,
  );
  for (const child of existing.children) {
    if (reactivate && child.status !== "received") continue;
    const childInput: UpdatePreorderInput = {
      ...rootRequest,
      orderUrl: undefined,
      receivedDate: undefined,
      deliveryMethod: undefined,
      deliveryCost: undefined,
      price: mode === "lot" ? 0 : childPrices.get(child.id),
      pricingMode: mode as "lot" | "per_item",
    };
    if (
      ["received", "cancelled"].includes(child.status) &&
      childInput.status !== child.status &&
      !reactivate
    )
      childInput.status = child.status as PreorderStatus;
    if (
      result.status === "received" &&
      childInput.status === "received" &&
      (child.status !== "received" ||
        (rootRequest.receivedDate !== undefined &&
          (!child.receivedDate ||
            child.receivedDate.getTime() === existing.receivedDate?.getTime())))
    )
      childInput.receivedDate = result.receivedDate?.toISOString();
    await applyPreorderChange(tx, child, childInput, reactivate);
    await tx.preorder.update({
      where: { id: child.id },
      data: { priceKnown: mode !== "lot" },
    });
  }
  if (expansions.length || accessories.length) {
    if (
      mode !== "lot" &&
      [...expansions, ...accessories].some((item) => item.price === undefined)
    )
      throw ApiError.badRequest(
        "POSITION_PRICE_REQUIRED",
        "Укажите стоимость добавляемых позиций или выберите цену всего лота",
      );
    const additions = [
      ...(await linkExpansionsInTransaction(
        tx,
        existing.itemId,
        expansions,
        prepared,
      )),
      ...(await linkExpansionsInTransaction(
        tx,
        existing.itemId,
        accessories,
        preparedAccessories,
        "accessory",
      )),
    ];
    for (const addition of additions) {
      if (existing.children.some((child) => child.itemId === addition.itemId))
        throw ApiError.conflict(
          "POSITION_ALREADY_IN_LOT",
          "Эта позиция уже входит в лот",
        );
      const child = await createPreorderInTransaction(
        tx,
        addition.itemId,
        {
          shop: result.shop,
          currency: result.currency,
          price: mode === "lot" ? 0 : addition.price!,
          pricingMode: mode as "lot" | "per_item",
          paymentType: result.paymentType as
            "one_time" | "installments" | "unspecified",
          orderDate: result.orderDate?.toISOString() ?? null,
          expectedDate: result.expectedDate?.toISOString() ?? null,
          expectedDatePrecision: storedExpectedDatePrecision(result),
          trackingNumber: result.trackingNumber,
          comment: result.comment,
          status: isActiveStatus(result.status) ? result.status : "ordered",
        },
        { parentId: existing.id, priceKnown: mode !== "lot" },
      );
      if (result.status === "received" || result.status === "cancelled")
        await applyPreorderChange(
          tx,
          child,
          {
            status: result.status,
            ...(result.status === "received" && result.receivedDate
              ? { receivedDate: result.receivedDate.toISOString() }
              : {}),
          },
          false,
        );
    }
  }
  return result;
}
async function applyPreorderChange(
  tx: Prisma.TransactionClient,
  existing: Preorder,
  request: UpdatePreorderInput,
  reactivate: boolean,
) {
  const preorderId = existing.id;
  let input = { ...request };
  if (reactivate) {
    if (existing.status !== "received")
      throw ApiError.conflict(
        "PREORDER_NOT_RECEIVED",
        "Only a received preorder can be reactivated",
      );
    const previous = await tx.preorderEvent.findFirst({
      where: { preorderId, type: "status_changed", newValue: "received" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    input = {
      status: isActiveStatus(previous?.oldValue)
        ? previous.oldValue
        : "shipped",
      receivedDate: null,
    };
  }
  const status = input.status ?? existing.status;
  const statusChanged = status !== existing.status;
  if (statusChanged && !isActiveStatus(existing.status) && !reactivate)
    throw ApiError.conflict(
      "INVALID_PREORDER_TRANSITION",
      "A completed preorder requires an explicit reactivation command",
    );
  if (status !== "received" && input.receivedDate)
    throw ApiError.badRequest(
      "INVALID_RECEIVED_DATE",
      "Only received preorders have a received date",
    );
  if (status === "received" && input.receivedDate === null)
    throw ApiError.badRequest(
      "RECEIVED_DATE_REQUIRED",
      "Received date cannot be null",
    );
  const receivedDate =
    status === "received"
      ? (toDate(input.receivedDate) ??
        (existing.status === "received" ? existing.receivedDate : null) ??
        new Date())
      : null;
  const expected = resolveExpectedDateUpdate(existing, input);
  const publisher =
    input.shop !== undefined
      ? await ensurePublisher(tx, input.shop)
      : undefined;
  await tx.preorder.update({
    where: { id: preorderId },
    data: {
      pricingMode: input.pricingMode,
      fullyPaid:
        input.fullyPaid ??
        existing.fullyPaid ??
        (existing.status === "paid" ? true : undefined),
      paymentVersion:
        input.fullyPaid !== undefined ? { increment: 1 } : undefined,
      paymentType: input.paymentType,
      shop: publisher?.name,
      price: input.price,
      currency: input.currency,
      orderUrl: input.orderUrl,
      deliveryMethod: input.deliveryMethod,
      deliveryCost: input.deliveryCost,
      trackingNumber: input.trackingNumber,
      comment: input.comment,
      orderDate: "orderDate" in input ? toDate(input.orderDate) : undefined,
      expectedDate: expected?.date,
      expectedDatePrecision: expected?.precision,
      status,
      receivedDate,
    },
  });
  if (
    expected &&
    (!sameDate(existing.expectedDate, expected.date) ||
      storedExpectedDatePrecision(existing) !== expected.precision)
  ) {
    await tx.preorderEvent.create({
      data: {
        preorderId,
        type: "expected_date_changed",
        oldValue: JSON.stringify({
          expectedDate: existing.expectedDate?.toISOString() ?? null,
          expectedDatePrecision: storedExpectedDatePrecision(existing),
        }),
        newValue: JSON.stringify({
          expectedDate: expected.date?.toISOString() ?? null,
          expectedDatePrecision: expected.precision,
        }),
      },
    });
  }
  if (statusChanged) {
    await tx.preorderEvent.create({
      data: {
        preorderId,
        type: "status_changed",
        oldValue: existing.status,
        newValue: status,
      },
    });
    if (status === "received") {
      const current = await tx.userItem.findUnique({
        where: { itemId: existing.itemId },
      });
      const next = resolveUserItemTransition(current, collectionTransition());
      await tx.userItem.upsert({
        where: { itemId: existing.itemId },
        create: { itemId: existing.itemId, ...next },
        update: next,
      });
    }
    if (status === "cancelled") {
      const current = await tx.userItem.findUnique({
        where: { itemId: existing.itemId },
      });
      const remaining = await tx.preorder.count({
        where: {
          OR: [
            { itemId: existing.itemId },
            { children: { some: { itemId: existing.itemId } } },
          ],
          id: { not: existing.parentId ?? preorderId },
          status: { in: activeStatuses },
        },
      });
      if (current && !current.owned)
        await tx.userItem.update({
          where: { itemId: existing.itemId },
          data: {
            status: current.wishlist || remaining > 0 ? "active" : "archived",
          },
        });
    }
  }
  return tx.preorder.findUniqueOrThrow({
    where: { id: preorderId },
    include: preorderInclude,
  });
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
  const { preorder, event, precision } =
    await updatePreorderExpectedDateCommand(preorderId, input);
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
    const existing = await tx.preorder.findFirst({
      where: { id: preorderId, item: { deletedAt: null } },
    });
    if (!existing) throw preorderNotFound();
    if (existing.parentId)
      throw ApiError.conflict(
        "EDIT_LOT",
        "Измените срок всего лота через предзаказ основной игры.",
      );

    const nextExpected = resolveExpectedDate(
      input.expectedDate,
      input.expectedDatePrecision,
    );
    const children = await tx.preorder.findMany({
      where: { parentId: preorderId },
    });
    for (const child of children) {
      await tx.preorder.update({
        where: { id: child.id },
        data: {
          expectedDate: nextExpected.date,
          expectedDatePrecision: nextExpected.precision,
        },
      });
      if (
        !sameDate(child.expectedDate, nextExpected.date) ||
        storedExpectedDatePrecision(child) !== nextExpected.precision
      )
        await tx.preorderEvent.create({
          data: {
            preorderId: child.id,
            type: "expected_date_changed",
            oldValue: JSON.stringify({
              expectedDate: child.expectedDate?.toISOString() ?? null,
              expectedDatePrecision: storedExpectedDatePrecision(child),
            }),
            newValue: JSON.stringify({
              expectedDate: nextExpected.date?.toISOString() ?? null,
              expectedDatePrecision: nextExpected.precision,
            }),
            reason: input.reason,
            comment: input.comment,
          },
        });
    }
    const preorder = await tx.preorder.update({
      where: { id: preorderId },
      data: {
        expectedDate: nextExpected.date,
        expectedDatePrecision: nextExpected.precision,
      },
      select: preorderLotSelect,
    });
    const event = await tx.preorderEvent.create({
      data: {
        preorderId,
        type: "expected_date_changed",
        oldValue: JSON.stringify({
          expectedDate: existing.expectedDate?.toISOString() ?? null,
          expectedDatePrecision: storedExpectedDatePrecision(existing),
        }),
        newValue: JSON.stringify({
          expectedDate: nextExpected.date?.toISOString() ?? null,
          expectedDatePrecision: nextExpected.precision,
        }),
        reason: input.reason,
        comment: input.comment,
      },
    });

    return { preorder, event, precision: nextExpected.precision };
  });
}

export async function deletePreorder(preorderId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.preorder.findFirst({
      where: { id: preorderId, item: { deletedAt: null } },
    });
    if (!existing) throw preorderNotFound();
    if (existing.parentId)
      throw ApiError.conflict(
        "EDIT_LOT",
        "Удалите лот через предзаказ основной игры.",
      );
    await tx.preorder.delete({ where: { id: preorderId } });
  });
}

async function getPreorderDto(preorderId: string) {
  const preorder = await prisma.preorder.findFirst({
    where: {
      id: preorderId,
      item: { deletedAt: null },
    },
    include: preorderInclude,
  });

  if (!preorder) {
    throw preorderNotFound();
  }

  return mapLegacyPreorder(preorder, preorder.item.title);
}

async function getPreorderOrThrow(preorderId: string) {
  const preorder = await prisma.preorder.findFirst({
    where: {
      id: preorderId,
      item: { deletedAt: null },
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
  value: string | null | undefined,
  precision: ExpectedDatePrecision,
) {
  if (precision === "unknown") {
    if (value) {
      throw ApiError.badRequest(
        "EXPECTED_DATE_MUST_BE_NULL",
        "Unknown precision requires a null expected date",
      );
    }
    return null;
  }
  if (!value) {
    throw ApiError.badRequest(
      "EXPECTED_DATE_REQUIRED",
      "A date is required for day, month or quarter precision",
    );
  }
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  if (precision === "month") date.setUTCDate(1);
  if (precision === "quarter") {
    date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3, 1);
  }
  return date;
}

function resolveExpectedDate(
  value: string | null | undefined,
  precision?: ExpectedDatePrecision,
) {
  const resolvedPrecision = precision ?? (value ? "day" : "unknown");
  return {
    date: normalizeExpectedDate(value, resolvedPrecision),
    precision: resolvedPrecision,
  };
}

function resolveExpectedDateUpdate(
  existing: {
    expectedDate: Date | null;
    expectedDatePrecision: string;
  },
  input: UpdatePreorderInput,
) {
  if (!("expectedDate" in input) && !("expectedDatePrecision" in input)) {
    return null;
  }

  const value =
    "expectedDate" in input
      ? input.expectedDate
      : (existing.expectedDate?.toISOString() ?? null);
  const precision =
    input.expectedDatePrecision ??
    ("expectedDate" in input
      ? value
        ? "day"
        : "unknown"
      : storedExpectedDatePrecision(existing));
  return resolveExpectedDate(value, precision);
}

function storedExpectedDatePrecision(preorder: {
  expectedDate: Date | null;
  expectedDatePrecision: string;
}): ExpectedDatePrecision {
  if (!preorder.expectedDate) return "unknown";
  return ["day", "month", "quarter", "unknown"].includes(
    preorder.expectedDatePrecision,
  )
    ? (preorder.expectedDatePrecision as ExpectedDatePrecision)
    : "day";
}

function sameDate(left?: Date | null, right?: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function isActive(preorder: { status: string }) {
  return isActiveStatus(preorder.status);
}

function isActiveStatus(
  status: string | null | undefined,
): status is PreorderStatus {
  return activeStatuses.some((activeStatus) => activeStatus === status);
}

function buildPreorderWhere(
  query: PreorderQueryDto,
): Prisma.PreorderWhereInput {
  return {
    parentId: null,
    ...(query.itemId
      ? {
          OR: [
            { itemId: query.itemId },
            { children: { some: { itemId: query.itemId } } },
          ],
        }
      : {}),
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
  deliveryMethod: true,
  deliveryCost: true,
  fullyPaid: true,
  orderUrl: true,
  paymentSchedule: true,
  paymentVersion: true,
  id: true,
  parentId: true,
  pricingMode: true,
  paymentType: true,
  priceKnown: true,
  itemId: true,
  shop: true,
  price: true,
  currency: true,
  orderDate: true,
  expectedDate: true,
  expectedDatePrecision: true,
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

export const preorderLotSelect = {
  ...preorderListSelect,
  children: {
    select: preorderListSelect,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.PreorderSelect;
