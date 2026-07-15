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
  LinkDto,
  LinkType,
  NoteDto,
  PlayListItemDto,
  PlaySessionDto,
  PlaySummaryDto,
  PreorderDto,
  PreorderEventDto,
  PreorderListItemDto,
  PreorderStatus,
  ProviderCode,
  PurchaseDto,
  TagDto,
  UserItemDto,
  WishlistCardDto,
} from "@/shared/api";

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
  parentRelations: ItemRelation[];
  childRelations: ItemRelation[];
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
  | "updatedAt"
> & {
  item: ItemForCompact &
    Pick<Item, "updatedAt"> & {
      tags: Tag[];
      playSessions: Pick<PlaySession, "playedAt">[];
      _count: {
        playSessions: number;
        preorders: number;
        purchases: number;
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
  | "updatedAt"
> & {
  item: ItemForCompact &
    Pick<Item, "mechanics" | "categories" | "updatedAt"> & {
      tags: Tag[];
      purchases: Pick<Purchase, "id">[];
      preorders: Pick<Preorder, "id">[];
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
    cover: item.images[0] ? mapImage(item.images[0]) : null,
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
      id: userItem.id,
      status: userItem.status as ItemStatus,
      personalRating: userItem.personalRating,
      location: userItem.location,
      tags: userItem.item.tags.map(mapTag),
    },
    playsCount: userItem.item._count.playSessions,
    lastPlayedAt: userItem.item.playSessions[0]?.playedAt.toISOString() ?? null,
    activePreordersCount: userItem.item._count.preorders,
    expansionsCount:
      userItem.item._count.parentRelations +
      userItem.item._count.childRelations,
    purchasesCount: userItem.item._count.purchases,
    updatedAt: latestDate([
      userItem.updatedAt,
      userItem.item.updatedAt,
    ]).toISOString(),
  };
}

export function mapCollectionCardToLegacy(
  userItem: UserItemForCollectionCard,
): ItemListDto {
  const card = mapCollectionCard(userItem);

  return {
    item: {
      id: card.item.id,
      type: card.item.type,
      title: card.item.title,
      originalTitle: card.item.originalTitle,
      year: card.item.year,
      rating: card.item.communityRating,
    },
    userItem: {
      status: card.userItem.status,
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      personalRating: card.userItem.personalRating,
      location: card.userItem.location,
      interestLevel: userItem.interestLevel,
    },
    mainImage: card.item.cover,
    playsCount: card.playsCount,
    lastPlayedAt: card.lastPlayedAt,
    activePreordersCount: card.activePreordersCount,
    purchasesCount: card.purchasesCount,
    updatedAt: card.updatedAt,
  };
}

export function mapWishlistCard(
  userItem: UserItemForWishlistCard,
): WishlistCardDto {
  return {
    item: mapItemCompact(userItem.item),
    userItem: {
      id: userItem.id,
      status: userItem.status as ItemStatus,
      interestLevel: userItem.interestLevel,
      decisionNotes: userItem.decisionNotes,
      tags: userItem.item.tags.map(mapTag),
    },
    mechanics: jsonStringArray(userItem.item.mechanics),
    categories: jsonStringArray(userItem.item.categories),
    priceSignal: {
      hasPurchases: userItem.item.purchases.length > 0,
      hasPreorders: userItem.item.preorders.length > 0,
      shopLinksCount: userItem.item._count.links,
    },
    updatedAt: latestDate([
      userItem.updatedAt,
      userItem.item.updatedAt,
    ]).toISOString(),
  };
}

export function mapWishlistCardToLegacy(
  userItem: UserItemForWishlistCard,
): ItemListDto {
  const card = mapWishlistCard(userItem);

  return {
    item: {
      id: card.item.id,
      type: card.item.type,
      title: card.item.title,
      originalTitle: card.item.originalTitle,
      year: card.item.year,
      rating: card.item.communityRating,
    },
    userItem: {
      status: card.userItem.status,
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      personalRating: userItem.personalRating,
      location: userItem.location,
      interestLevel: card.userItem.interestLevel,
    },
    mainImage: card.item.cover,
    playsCount: userItem.item._count.playSessions,
    lastPlayedAt: userItem.item.playSessions[0]?.playedAt.toISOString() ?? null,
    activePreordersCount: userItem.item._count.preorders,
    purchasesCount: userItem.item._count.purchases,
    updatedAt: card.updatedAt,
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
): PlayListItemDto {
  const { itemTitle: _itemTitle, ...session } = mapPlaySession(play);

  return {
    ...session,
    item: mapItemCompact(play.item),
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
    isSystem: itemType.isSystem,
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
    events: preorder.events.map(mapPreorderEvent),
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
    itemId: preorder.itemId,
    item: mapItemCompact(preorder.item),
    shop: preorder.shop,
    price: decimalToNumber(preorder.price) ?? 0,
    currency: preorder.currency,
    orderDate: preorder.orderDate?.toISOString() ?? null,
    expectedDate: preorder.expectedDate?.toISOString() ?? null,
    receivedDate: preorder.receivedDate?.toISOString() ?? null,
    trackingNumber: preorder.trackingNumber,
    status: preorder.status as PreorderStatus,
    uiStatus: getPreorderUiStatus(preorder, now),
    comment: preorder.comment,
    createdAt: preorder.createdAt.toISOString(),
    updatedAt: preorder.updatedAt.toISOString(),
  };
}

function getPreorderUiStatus(preorder: Preorder, now: Date) {
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

function mapPreorderEvent(event: PreorderEvent): PreorderEventDto {
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
