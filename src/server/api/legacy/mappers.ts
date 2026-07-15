import type { PlaySession, Preorder, PreorderEvent, Purchase } from "@prisma/client";

import type {
  LegacyPlaySessionDto,
  LegacyPreorderDto,
  LegacyPreorderEventDto,
  LegacyPurchaseDto,
} from "@/shared/api/legacy";

export function mapLegacyPurchase(purchase: Purchase): LegacyPurchaseDto {
  return {
    id: purchase.id,
    itemId: purchase.itemId,
    shop: purchase.shop,
    price: toNumber(purchase.price),
    currency: purchase.currency,
    deliveryCost: nullableNumber(purchase.deliveryCost),
    discount: nullableNumber(purchase.discount),
    totalPrice: toNumber(purchase.totalPrice),
    purchaseDate: purchase.purchaseDate?.toISOString() ?? null,
    comment: purchase.comment,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

export function mapLegacyPreorder(
  preorder: Preorder & { events: PreorderEvent[] },
  itemTitle: string,
): LegacyPreorderDto {
  return {
    id: preorder.id,
    itemId: preorder.itemId,
    itemTitle,
    shop: preorder.shop,
    price: toNumber(preorder.price),
    currency: preorder.currency,
    orderDate: preorder.orderDate?.toISOString() ?? null,
    expectedDate: preorder.expectedDate?.toISOString() ?? null,
    receivedDate: preorder.receivedDate?.toISOString() ?? null,
    trackingNumber: preorder.trackingNumber,
    status: preorder.status as LegacyPreorderDto["status"],
    comment: preorder.comment,
    events: preorder.events.map(mapLegacyPreorderEvent),
    createdAt: preorder.createdAt.toISOString(),
    updatedAt: preorder.updatedAt.toISOString(),
  };
}

export function mapLegacyPreorderEvent(
  event: PreorderEvent,
): LegacyPreorderEventDto {
  return {
    id: event.id,
    preorderId: event.preorderId,
    type: event.type,
    oldValue: event.oldValue,
    newValue: event.newValue,
    reason: event.reason,
    comment: event.comment,
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapLegacyPlaySession(
  play: PlaySession & { item?: { title: string } },
): LegacyPlaySessionDto {
  return {
    id: play.id,
    itemId: play.itemId,
    itemTitle: play.item?.title ?? "",
    playedAt: play.playedAt.toISOString(),
    playersCount: play.playersCount,
    durationMinutes: play.durationMinutes,
    result: play.result as LegacyPlaySessionDto["result"],
    score: play.score,
    scenario: play.scenario,
    playerNames: stringArray(play.playerNames),
    usedItemIds: stringArray(play.usedItemIds),
    notes: play.notes,
    source: play.source as LegacyPlaySessionDto["source"],
    bggPlayId: play.bggPlayId,
    locallyModifiedAt: play.locallyModifiedAt?.toISOString() ?? null,
    createdAt: play.createdAt.toISOString(),
    updatedAt: play.updatedAt.toISOString(),
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
