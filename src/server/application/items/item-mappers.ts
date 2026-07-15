import type {
  ExternalReference,
  Image,
  Item,
  ItemRelation,
  ItemType,
  Link,
  Note,
  PlaySession,
  Preorder,
  PreorderEvent,
  Purchase,
  Tag,
  UserItem,
} from "@prisma/client";

import type {
  CollectionCardDto,
  CollectionItemDetailDto,
  ExternalReferenceDto,
  ImageDto,
  ItemCompactDto,
  ItemDetailsDto,
  ItemDto,
  ItemListDto,
  ItemRelationDto,
  ItemStatus,
  ItemTypeCode,
  ItemTypeDto,
  LegacyPreorderEventDto,
  LinkDto,
  LinkType,
  NoteDto,
  PlayListItemDto,
  PlayResult,
  PlaySessionDto,
  PlaySummaryDto,
  PreorderDto,
  PreorderEventDto,
  PreorderListItemDto,
  PreorderSummaryDto,
  PreorderStatus,
  ProviderCode,
  PurchaseDto,
  TagDto,
  UserItemDto,
  UserItemDetailDto,
  WishlistCardDto,
  WishlistItemDetailDto,
} from "@/shared/api";
import {
  resolveLifecycleStatus,
  resolveUserItemStates,
} from "@/server/application/items/user-item-state";

export type ItemForDetails = Item & {
  type: ItemType;
  userItem: UserItem | null;
  externalReferences: ExternalReference[];
  images: Image[];
  links: Link[];
  purchases: Purchase[];
  preorders: (Preorder & { events: PreorderEvent[] })[];
  playSessions: PlaySession[];
  notes: Note[];
  tags: Tag[];
  parentRelations: (ItemRelation & { childItem: ItemForCompact })[];
  childRelations: (ItemRelation & { parentItem: ItemForCompact })[];
};

export type UserItemForList = UserItem & {
  item: Item & {
    type: ItemType;
    images: Image[];
    playSessions: PlaySession[];
    preorders: Preorder[];
    purchases: Purchase[];
    tags: Tag[];
    links?: Link[];
  };
};

export type UserItemWithTags = UserItem & {
  item: {
    tags: Tag[];
  };
};

export type ItemForCompact = Pick<
  Item,
  | "id"
  | "title"
  | "originalTitle"
  | "year"
  | "minPlayers"
  | "maxPlayers"
  | "minPlayTime"
  | "maxPlayTime"
  | "rating"
> & {
  type: ItemType;
  images: Image[];
};

export type UserItemForCollectionCard = Pick<
  UserItem,
  | "id"
  | "status"
  | "owned"
  | "wishlist"
  | "personalRating"
  | "location"
  | "interestLevel"
  | "createdAt"
  | "updatedAt"
> & {
  item: ItemForCompact &
    Pick<Item, "updatedAt"> & {
      tags: Tag[];
      playSessions: Pick<PlaySession, "playedAt" | "result">[];
      preorders: Pick<
        Preorder,
        "id" | "status" | "expectedDate" | "price" | "currency"
      >[];
      purchases: Pick<Purchase, "totalPrice" | "currency">[];
      _count: {
        playSessions: number;
        preorders: number;
        purchases: number;
        images: number;
        parentRelations: number;
        childRelations: number;
      };
    };
};

export type UserItemForWishlistCard = Pick<
  UserItem,
  | "id"
  | "status"
  | "owned"
  | "wishlist"
  | "personalRating"
  | "location"
  | "interestLevel"
  | "decisionNotes"
  | "createdAt"
  | "updatedAt"
> & {
  item: ItemForCompact &
    Pick<
      Item,
      "mechanics" | "categories" | "minAge" | "complexity" | "updatedAt"
    > & {
      tags: Tag[];
      purchases: Pick<Purchase, "id" | "totalPrice" | "currency">[];
      preorders: Pick<
        Preorder,
        "id" | "status" | "expectedDate" | "price" | "currency"
      >[];
      links: Pick<Link, "id">[];
      playSessions: Pick<PlaySession, "playedAt">[];
      _count: {
        links: number;
        playSessions: number;
        preorders: number;
        purchases: number;
      };
    };
};

export function mapItemDetails(item: ItemForDetails): ItemDetailsDto {
  if (!item.userItem) {
    throw new Error("Item details require a UserItem");
  }

  return {
    item: mapItem(item),
    userItem: mapUserItem({ ...item.userItem, item: { tags: item.tags } }),
    externalReferences: item.externalReferences.map(mapExternalReference),
    images: item.images.map(mapImage),
    links: item.links.map(mapLink),
    purchases: item.purchases.map(mapPurchase),
    preorders: item.preorders.map((preorder) =>
      mapPreorder(preorder, item.title),
    ),
    playSummary: mapPlaySummary(item.playSessions),
    notes: item.notes.map(mapNote),
    relations: [
      ...item.parentRelations.map(mapItemRelation),
      ...item.childRelations.map(mapItemRelation),
    ],
  };
}

export function mapItemList(userItem: UserItemForList): ItemListDto {
  const { item } = userItem;
  const mainImage = item.images[0] ? mapImage(item.images[0]) : null;
  const lastPlayedAt = getLastPlayedAt(item.playSessions);

  return {
    item: {
      id: item.id,
      type: mapItemType(item.type),
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      rating: decimalToNumber(item.rating),
    },
    userItem: {
      status: userItem.status as ItemStatus,
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      personalRating: userItem.personalRating,
      location: userItem.location,
      interestLevel: userItem.interestLevel,
    },
    mainImage,
    playsCount: item.playSessions.length,
    lastPlayedAt: lastPlayedAt?.toISOString() ?? null,
    activePreordersCount: item.preorders.filter(isActivePreorder).length,
    purchasesCount: item.purchases.length,
    updatedAt: latestDate([userItem.updatedAt, item.updatedAt]).toISOString(),
  };
}

export function mapItemCompact(item: ItemForCompact): ItemCompactDto {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    type: mapItemType(item.type),
    year: item.year,
    cover: item.images[0] ? mapImageCompact(item.images[0], item.title) : null,
    minPlayers: item.minPlayers,
    maxPlayers: item.maxPlayers,
    minPlayTime: item.minPlayTime,
    maxPlayTime: item.maxPlayTime,
    communityRating: decimalToNumber(item.rating),
  };
}

export function mapCollectionCard(
  userItem: UserItemForCollectionCard,
): CollectionCardDto {
  return {
    item: mapItemCompact(userItem.item),
    userItem: {
      states: resolveUserItemStates({
        ...userItem,
        hasActivePreorder: userItem.item._count.preorders > 0,
        hasPlays: userItem.item._count.playSessions > 0,
      }),
      ownedAt: userItem.createdAt.toISOString(),
      favorite: false,
      personalRating: userItem.personalRating,
      location: userItem.location,
      tags: userItem.item.tags.map(mapTag),
    },
    plays: {
      count: userItem.item._count.playSessions,
      lastPlayedAt:
        userItem.item.playSessions[0]?.playedAt.toISOString() ?? null,
      lastResult:
        (userItem.item.playSessions[0]?.result as PlayResult | null) ?? null,
    },
    expansionsCount:
      userItem.item._count.parentRelations +
      userItem.item._count.childRelations,
    imagesCount: userItem.item._count.images,
    activePreorder: userItem.item.preorders[0]
      ? mapPreorderSummary(userItem.item.preorders[0])
      : null,
    purchaseTotal: sumMoney(userItem.item.purchases),
  };
}

export function mapCollectionCardToLegacy(
  userItem: UserItemForCollectionCard,
): ItemListDto {
  return {
    item: {
      id: userItem.item.id,
      type: mapItemType(userItem.item.type),
      title: userItem.item.title,
      originalTitle: userItem.item.originalTitle,
      year: userItem.item.year,
      rating: decimalToNumber(userItem.item.rating),
    },
    userItem: {
      status: userItem.status as ItemStatus,
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      personalRating: userItem.personalRating,
      location: userItem.location,
      interestLevel: userItem.interestLevel,
    },
    mainImage: userItem.item.images[0] ? mapImage(userItem.item.images[0]) : null,
    playsCount: userItem.item._count.playSessions,
    lastPlayedAt:
      userItem.item.playSessions[0]?.playedAt.toISOString() ?? null,
    activePreordersCount: userItem.item._count.preorders,
    purchasesCount: userItem.item._count.purchases,
    updatedAt: latestDate([
      userItem.updatedAt,
      userItem.item.updatedAt,
    ]).toISOString(),
  };
}

export function mapWishlistCard(
  userItem: UserItemForWishlistCard,
): WishlistCardDto {
  return {
    item: {
      ...mapItemCompact(userItem.item),
      minAge: userItem.item.minAge,
      complexity: decimalToNumber(userItem.item.complexity),
    },
    userItem: {
      states: resolveUserItemStates({
        ...userItem,
        hasActivePreorder: userItem.item._count.preorders > 0,
        hasPlays: userItem.item._count.playSessions > 0,
      }),
      interestLevel: userItem.interestLevel,
      decisionNotes: userItem.decisionNotes,
      tags: userItem.item.tags.map(mapTag),
    },
    mechanics: jsonStringArray(userItem.item.mechanics),
    categories: jsonStringArray(userItem.item.categories),
    priceSignal:
      lowestMoney(userItem.item.purchases) ??
      lowestMoney(userItem.item.preorders),
    activePreorder: userItem.item.preorders[0]
      ? mapPreorderSummary(userItem.item.preorders[0])
      : null,
  };
}

export function mapWishlistCardToLegacy(
  userItem: UserItemForWishlistCard,
): ItemListDto {
  return {
    item: {
      id: userItem.item.id,
      type: mapItemType(userItem.item.type),
      title: userItem.item.title,
      originalTitle: userItem.item.originalTitle,
      year: userItem.item.year,
      rating: decimalToNumber(userItem.item.rating),
    },
    userItem: {
      status: userItem.status as ItemStatus,
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      personalRating: userItem.personalRating,
      location: userItem.location,
      interestLevel: userItem.interestLevel,
    },
    mainImage: userItem.item.images[0] ? mapImage(userItem.item.images[0]) : null,
    playsCount: userItem.item._count.playSessions,
    lastPlayedAt: userItem.item.playSessions[0]?.playedAt.toISOString() ?? null,
    activePreordersCount: userItem.item._count.preorders,
    purchasesCount: userItem.item._count.purchases,
    updatedAt: latestDate([
      userItem.updatedAt,
      userItem.item.updatedAt,
    ]).toISOString(),
  };
}

export function mapUserItem(userItem: UserItemWithTags): UserItemDto {
  return {
    id: userItem.id,
    itemId: userItem.itemId,
    status: userItem.status as ItemStatus,
    owned: userItem.owned,
    wishlist: userItem.wishlist,
    location: userItem.location,
    personalRating: userItem.personalRating,
    notes: userItem.notes,
    interestLevel: userItem.interestLevel,
    decisionNotes: userItem.decisionNotes,
    tags: userItem.item.tags.map(mapTag),
  };
}

export function mapPlaySession(
  play: PlaySession & { item?: Pick<Item, "title"> },
): PlaySessionDto {
  return {
    id: play.id,
    itemId: play.itemId,
    itemTitle: play.item?.title ?? "",
    playedAt: play.playedAt.toISOString(),
    playersCount: play.playersCount,
    durationMinutes: play.durationMinutes,
    result: play.result as PlaySessionDto["result"],
    score: play.score,
    scenario: play.scenario,
    playerNames: jsonStringArray(play.playerNames),
    usedItemIds: jsonStringArray(play.usedItemIds),
    notes: play.notes,
    source: play.source as PlaySessionDto["source"],
    bggPlayId: play.bggPlayId,
    locallyModifiedAt: play.locallyModifiedAt?.toISOString() ?? null,
    createdAt: play.createdAt.toISOString(),
    updatedAt: play.updatedAt.toISOString(),
  };
}

export function mapPlayListItem(
  play: PlaySession & { item: ItemForCompact },
  usedItems: ItemForCompact[] = [],
): PlayListItemDto {
  return {
    id: play.id,
    item: mapItemCompact(play.item),
    playedAt: play.playedAt.toISOString(),
    startedAt: null,
    playersCount: play.playersCount,
    durationMinutes: play.durationMinutes,
    result: play.result as PlayResult | null,
    score: play.score,
    scenario: play.scenario,
    playerNames: jsonStringArray(play.playerNames),
    usedItems: usedItems.map(mapItemCompact),
    personalRating: null,
    notes: play.notes,
    source: play.source as PlayListItemDto["source"],
  };
}

function mapItem(item: Item & { type: ItemType }): ItemDto {
  return {
    id: item.id,
    type: mapItemType(item.type),
    title: item.title,
    originalTitle: item.originalTitle,
    description: item.description,
    year: item.year,
    minPlayers: item.minPlayers,
    maxPlayers: item.maxPlayers,
    minPlayTime: item.minPlayTime,
    maxPlayTime: item.maxPlayTime,
    minAge: item.minAge,
    complexity: decimalToNumber(item.complexity),
    rating: decimalToNumber(item.rating),
    sourceMode: item.sourceMode as ItemDto["sourceMode"],
    categories: jsonStringArray(item.categories),
    mechanics: jsonStringArray(item.mechanics),
    designers: jsonStringArray(item.designers),
    artists: jsonStringArray(item.artists),
    publishers: jsonStringArray(item.publishers),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function mapItemType(itemType: ItemType): ItemTypeDto {
  return {
    id: itemType.id,
    code: itemType.code as ItemTypeCode,
    name: itemType.name,
  };
}

function mapTag(tag: Tag): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

function mapImage(image: Image): ImageDto {
  return {
    id: image.id,
    itemId: image.itemId,
    type: image.type as ImageDto["type"],
    provider: image.provider as ProviderCode | null,
    url: image.url,
    path: image.path,
    caption: image.caption,
    sortOrder: image.sortOrder,
    createdAt: image.createdAt.toISOString(),
  };
}

function mapImageCompact(image: Image, title: string) {
  return {
    id: image.id,
    url: image.url,
    path: image.path,
    alt: image.caption?.trim() || `Обложка «${title}»`,
  };
}

function mapExternalReference(
  externalReference: ExternalReference,
): ExternalReferenceDto {
  return {
    id: externalReference.id,
    itemId: externalReference.itemId,
    provider: externalReference.provider as ProviderCode,
    externalId: externalReference.externalId,
    url: externalReference.url,
    lastSync: externalReference.lastSync?.toISOString() ?? null,
  };
}

function mapLink(link: Link): LinkDto {
  return {
    id: link.id,
    itemId: link.itemId,
    type: link.type as LinkType,
    url: link.url,
    title: link.title,
  };
}

export function mapPurchase(purchase: Purchase): PurchaseDto {
  return {
    id: purchase.id,
    itemId: purchase.itemId,
    shop: purchase.shop,
    price: decimalToNumber(purchase.price) ?? 0,
    currency: purchase.currency,
    deliveryCost: decimalToNumber(purchase.deliveryCost),
    discount: decimalToNumber(purchase.discount),
    totalPrice: decimalToNumber(purchase.totalPrice) ?? 0,
    purchaseDate: purchase.purchaseDate?.toISOString() ?? null,
    comment: purchase.comment,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

export function mapPreorder(
  preorder: Preorder & { events: PreorderEvent[] },
  itemTitle: string,
): PreorderDto {
  return {
    id: preorder.id,
    itemId: preorder.itemId,
    itemTitle,
    shop: preorder.shop,
    price: decimalToNumber(preorder.price) ?? 0,
    currency: preorder.currency,
    orderDate: preorder.orderDate?.toISOString() ?? null,
    expectedDate: preorder.expectedDate?.toISOString() ?? null,
    receivedDate: preorder.receivedDate?.toISOString() ?? null,
    trackingNumber: preorder.trackingNumber,
    status: preorder.status as PreorderStatus,
    comment: preorder.comment,
    events: preorder.events.map(mapLegacyPreorderEvent),
    createdAt: preorder.createdAt.toISOString(),
    updatedAt: preorder.updatedAt.toISOString(),
  };
}

export function mapPreorderListItem(
  preorder: Preorder & { item: ItemForCompact },
  now = new Date(),
): PreorderListItemDto {
  return {
    id: preorder.id,
    item: mapItemCompact(preorder.item),
    shop: preorder.shop,
    price: money(preorder.price, preorder.currency),
    orderDate: preorder.orderDate?.toISOString() ?? null,
    expectedDate: preorder.expectedDate?.toISOString() ?? null,
    expectedDatePrecision: preorder.expectedDate ? "day" : "unknown",
    receivedDate: preorder.receivedDate?.toISOString() ?? null,
    trackingNumber: preorder.trackingNumber,
    status: preorder.status as PreorderStatus,
    uiStatus: getPreorderUiStatus(preorder, now),
    comment: preorder.comment,
    updatedAt: preorder.updatedAt.toISOString(),
  };
}

export function mapPreorderSummary(
  preorder: Pick<Preorder, "id" | "status" | "expectedDate">,
  now = new Date(),
): PreorderSummaryDto {
  return {
    id: preorder.id,
    status: preorder.status as PreorderStatus,
    uiStatus: getPreorderUiStatus(preorder, now),
    expectedDate: preorder.expectedDate?.toISOString() ?? null,
    expectedDatePrecision: preorder.expectedDate ? "day" : "unknown",
  };
}

function getPreorderUiStatus(
  preorder: Pick<Preorder, "status" | "expectedDate">,
  now: Date,
) {
  if (preorder.status === "received") {
    return "received" as const;
  }

  if (preorder.status === "cancelled") {
    return "cancelled" as const;
  }

  if (preorder.expectedDate && preorder.expectedDate < now) {
    return "delayed" as const;
  }

  return "active" as const;
}

function mapLegacyPreorderEvent(event: PreorderEvent): LegacyPreorderEventDto {
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

export function mapPreorderEvent(event: PreorderEvent): PreorderEventDto {
  const base = {
    id: event.id,
    reason: event.reason,
    comment: event.comment,
    createdAt: event.createdAt.toISOString(),
  };

  if (event.type === "expected_date_changed") {
    const oldValue = parseExpectedDateEventValue(event.oldValue);
    const newValue = parseExpectedDateEventValue(event.newValue);
    return {
      ...base,
      type: "expected_date_changed",
      oldValue: oldValue.value,
      newValue: newValue.value,
      legacyFormat: oldValue.legacy || newValue.legacy,
    };
  }

  return {
    ...base,
    type: "status_changed",
    oldValue: asPreorderStatus(event.oldValue),
    newValue: asPreorderStatus(event.newValue),
  };
}

function mapPlaySummary(playSessions: PlaySession[]): PlaySummaryDto {
  return {
    playsCount: playSessions.length,
    lastPlayedAt: getLastPlayedAt(playSessions)?.toISOString() ?? null,
    totalDurationMinutes: playSessions.reduce(
      (total, playSession) => total + (playSession.durationMinutes ?? 0),
      0,
    ),
  };
}

export function mapCollectionItemDetail(
  item: ItemForDetails,
  recentPlays: PlayListItemDto[],
): CollectionItemDetailDto {
  if (!item.userItem) throw new Error("Collection detail requires a UserItem");

  return {
    item: mapItemReferenceDetail(item),
    userItem: mapUserItemDetail(item.userItem, item),
    playSummary: {
      count: item.playSessions.length,
      lastPlayedAt: getLastPlayedAt(item.playSessions)?.toISOString() ?? null,
      totalDurationMinutes: item.playSessions.reduce(
        (total, play) => total + (play.durationMinutes ?? 0),
        0,
      ),
    },
    recentPlays,
    purchases: item.purchases.map((purchase) => ({
      id: purchase.id,
      shop: purchase.shop,
      price: money(purchase.price, purchase.currency),
      deliveryCost:
        purchase.deliveryCost == null
          ? null
          : money(purchase.deliveryCost, purchase.currency),
      discount:
        purchase.discount == null
          ? null
          : money(purchase.discount, purchase.currency),
      totalPrice: money(purchase.totalPrice, purchase.currency),
      purchaseDate: purchase.purchaseDate?.toISOString() ?? null,
      comment: purchase.comment,
    })),
    preorders: item.preorders.map((preorder) =>
      mapPreorderListItem({ ...preorder, item }),
    ),
    notes: item.notes.map(({ itemId: _itemId, ...note }) => ({
      id: note.id,
      title: note.title,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    primaryAction: "add_play",
  };
}

export function mapWishlistItemDetail(
  item: ItemForDetails,
  similarItems: ItemForCompact[] = [],
): WishlistItemDetailDto {
  if (!item.userItem) throw new Error("Wishlist detail requires a UserItem");
  const links = item.links.map(({ itemId: _itemId, ...link }) => ({
    id: link.id,
    type: link.type as LinkType,
    url: link.url,
    title: link.title,
  }));

  return {
    item: mapItemReferenceDetail(item),
    userItem: mapUserItemDetail(item.userItem, item),
    shopLinks: links.filter((link) =>
      ["shop", "kickstarter", "gamefound"].includes(link.type),
    ),
    videos: links.filter((link) => link.type === "youtube"),
    similarItems: similarItems.map(mapItemCompact),
    primaryActions: ["add_to_collection", "create_preorder"],
  };
}

function mapItemReferenceDetail(item: ItemForDetails) {
  const taxonomy = (value: unknown) =>
    jsonStringArray(value).map((name) => ({ id: name, name }));
  const withoutItemId = <T extends { itemId: string }>(value: T) => {
    const { itemId: _itemId, ...rest } = value;
    return rest;
  };

  return {
    ...mapItemCompact(item),
    description: item.description,
    minAge: item.minAge,
    complexity: decimalToNumber(item.complexity),
    mechanics: taxonomy(item.mechanics),
    categories: taxonomy(item.categories),
    designers: taxonomy(item.designers),
    artists: taxonomy(item.artists),
    publishers: taxonomy(item.publishers),
    images: item.images.map((image) => withoutItemId(mapImage(image))),
    externalReferences: item.externalReferences.map((reference) =>
      withoutItemId(mapExternalReference(reference)),
    ),
    links: item.links.map((link) => withoutItemId(mapLink(link))),
    relations: [
      ...item.parentRelations.map((relation) => ({
        id: relation.id,
        direction: "child" as const,
        relationType: relation.relationType,
        relatedItem: mapItemCompact(relation.childItem),
        comment: relation.comment,
      })),
      ...item.childRelations.map((relation) => ({
        id: relation.id,
        direction: "parent" as const,
        relationType: relation.relationType,
        relatedItem: mapItemCompact(relation.parentItem),
        comment: relation.comment,
      })),
    ],
  };
}

function mapUserItemDetail(
  userItem: UserItem,
  item: ItemForDetails,
): UserItemDetailDto {
  return {
    id: userItem.id,
    states: resolveUserItemStates({
      ...userItem,
      hasActivePreorder: item.preorders.some(isActivePreorder),
      hasPlays: item.playSessions.length > 0,
    }),
    lifecycleStatus: resolveLifecycleStatus(userItem.status),
    owned: userItem.owned,
    wishlist: userItem.wishlist,
    ownedAt: userItem.owned ? userItem.createdAt.toISOString() : null,
    favorite: false,
    location: userItem.location,
    personalRating: userItem.personalRating,
    notes: userItem.notes,
    interestLevel: userItem.interestLevel,
    decisionNotes: userItem.decisionNotes,
    tags: item.tags.map(mapTag),
  };
}

function mapNote(note: Note): NoteDto {
  return {
    id: note.id,
    itemId: note.itemId,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function mapItemRelation(relation: ItemRelation): ItemRelationDto {
  return {
    id: relation.id,
    parentItemId: relation.parentItemId,
    childItemId: relation.childItemId,
    relationType: relation.relationType,
    comment: relation.comment,
    createdAt: relation.createdAt.toISOString(),
    updatedAt: relation.updatedAt.toISOString(),
  };
}

function isActivePreorder(preorder: Preorder) {
  return preorder.status !== "received" && preorder.status !== "cancelled";
}

function getLastPlayedAt(playSessions: PlaySession[]) {
  return playSessions.reduce<Date | null>((latest, playSession) => {
    if (!latest || playSession.playedAt > latest) {
      return playSession.playedAt;
    }

    return latest;
  }, null);
}

function latestDate(dates: Date[]) {
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function money(amount: unknown, currency: string) {
  return { amount: decimalToNumber(amount) ?? 0, currency };
}

function sumMoney(
  values: { totalPrice: unknown; currency: string }[],
) {
  if (values.length === 0) return null;
  const currency = values[0].currency;
  if (values.some((value) => value.currency !== currency)) return null;
  return money(
    values.reduce(
      (total, value) => total + (decimalToNumber(value.totalPrice) ?? 0),
      0,
    ),
    currency,
  );
}

function lowestMoney(
  values: { totalPrice?: unknown; price?: unknown; currency: string }[],
) {
  if (values.length === 0) return null;
  const lowest = values.reduce((current, value) =>
    (decimalToNumber(value.totalPrice ?? value.price) ?? 0) <
    (decimalToNumber(current.totalPrice ?? current.price) ?? 0)
      ? value
      : current,
  );
  return money(lowest.totalPrice ?? lowest.price, lowest.currency);
}

function parseExpectedDateEventValue(value: string | null) {
  if (value === null) {
    return {
      value: {
        expectedDate: null,
        expectedDatePrecision: "unknown" as const,
      },
      legacy: false,
    };
  }

  try {
    const parsed = JSON.parse(value) as {
      expectedDate?: unknown;
      expectedDatePrecision?: unknown;
    };
    if (
      (typeof parsed.expectedDate === "string" ||
        parsed.expectedDate === null) &&
      ["day", "month", "quarter", "unknown"].includes(
        String(parsed.expectedDatePrecision),
      )
    ) {
      return {
        value: {
          expectedDate: parsed.expectedDate,
          expectedDatePrecision: parsed.expectedDatePrecision as
            | "day"
            | "month"
            | "quarter"
            | "unknown",
        },
        legacy: false,
      };
    }
  } catch {
    // Legacy events stored the ISO date directly.
  }

  return {
    value: { expectedDate: value, expectedDatePrecision: "day" as const },
    legacy: true,
  };
}

function asPreorderStatus(value: string | null): PreorderStatus | null {
  return ["planned", "ordered", "paid", "shipped", "received", "cancelled"].includes(
    value ?? "",
  )
    ? (value as PreorderStatus)
    : null;
}
