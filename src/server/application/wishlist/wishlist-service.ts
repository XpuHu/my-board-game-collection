import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapItemDetails,
  mapWishlistCard,
  mapWishlistCardToLegacy,
  type UserItemForWishlistCard,
} from "@/server/application/items/item-mappers";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";
import type {
  ItemListDto,
  PaginatedResponse,
  WishlistCardDto,
  WishlistItemDetailsDto,
} from "@/shared/api";

export type WishlistQuery = {
  q?: string;
  minRating?: number;
  players?: number;
  maxPlayTime?: number;
  mechanics?: string[];
  categories?: string[];
  hasPrice?: boolean;
};

export async function listWishlist(
  query: WishlistQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<ItemListDto>> {
  const page = await queryWishlist(query, pagination);

  return {
    ...page,
    data: page.data.map(mapWishlistCardToLegacy),
  };
}

export async function listWishlistCards(
  query: WishlistQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<WishlistCardDto>> {
  const page = await queryWishlist(query, pagination);

  return {
    ...page,
    data: page.data.map(mapWishlistCard),
  };
}

async function queryWishlist(
  query: WishlistQuery,
  pagination: PaginationInput,
) {
  const where = await buildWishlistWhere(query);
  const { page, pageSize } = pagination;
  const [total, userItems] = await prisma.$transaction([
    prisma.userItem.count({ where }),
    prisma.userItem.findMany({
      where,
      select: userItemWishlistCardSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: userItems as UserItemForWishlistCard[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getWishlistItem(
  itemId: string,
): Promise<WishlistItemDetailsDto> {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
      userItem: {
        wishlist: true,
      },
    },
    include: itemDetailsInclude,
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Wishlist item was not found");
  }

  const details = mapItemDetails(asItemForDetails(item));

  return {
    ...details,
    similarItems: [],
    videos: details.links.filter((link) => link.type === "youtube"),
    shopLinks: details.links.filter((link) =>
      ["shop", "kickstarter", "gamefound"].includes(link.type),
    ),
    primaryActions: ["add_to_collection", "create_preorder"],
  };
}

async function buildWishlistWhere(
  query: WishlistQuery,
): Promise<Prisma.UserItemWhereInput> {
  const itemAnd: Prisma.ItemWhereInput[] = [{ deletedAt: null }];

  if (query.q) {
    itemAnd.push({
      OR: [
        { title: { contains: query.q } },
        { originalTitle: { contains: query.q } },
      ],
    });
  }

  if (query.minRating !== undefined) {
    itemAnd.push({ rating: { gte: query.minRating } });
  }

  if (query.players !== undefined) {
    itemAnd.push(
      { OR: [{ minPlayers: null }, { minPlayers: { lte: query.players } }] },
      { OR: [{ maxPlayers: null }, { maxPlayers: { gte: query.players } }] },
    );
  }

  if (query.maxPlayTime !== undefined) {
    itemAnd.push({
      OR: [{ maxPlayTime: null }, { maxPlayTime: { lte: query.maxPlayTime } }],
    });
  }

  if (query.hasPrice !== undefined) {
    const priceSignal: Prisma.ItemWhereInput = {
      OR: [
        { purchases: { some: {} } },
        { preorders: { some: {} } },
        { links: { some: { type: "shop" } } },
      ],
    };
    itemAnd.push(query.hasPrice ? priceSignal : { NOT: priceSignal });
  }

  if (query.mechanics?.length || query.categories?.length) {
    const itemIds = await findTaxonomyItemIds(
      query.mechanics ?? [],
      query.categories ?? [],
    );
    itemAnd.push({ id: { in: itemIds } });
  }

  return {
    wishlist: true,
    item: { AND: itemAnd },
  };
}

async function findTaxonomyItemIds(mechanics: string[], categories: string[]) {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { id: true, mechanics: true, categories: true },
  });

  return items
    .filter(
      (item) =>
        containsAny(jsonStringArray(item.mechanics), mechanics) &&
        containsAny(jsonStringArray(item.categories), categories),
    )
    .map(({ id }) => id);
}

function containsAny(values: string[], queryValues: string[]) {
  if (queryValues.length === 0) {
    return true;
  }

  const normalized = new Set(values.map((value) => value.toLowerCase()));
  return queryValues.some((value) => normalized.has(value.toLowerCase()));
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];
const shopLinkTypes = ["shop", "kickstarter", "gamefound"];

const userItemWishlistCardSelect = {
  id: true,
  status: true,
  owned: true,
  wishlist: true,
  personalRating: true,
  location: true,
  interestLevel: true,
  decisionNotes: true,
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
      mechanics: true,
      categories: true,
      updatedAt: true,
      type: true,
      tags: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      purchases: { select: { id: true }, take: 1 },
      preorders: { select: { id: true }, take: 1 },
      links: {
        where: { type: { in: shopLinkTypes } },
        select: { id: true },
        take: 1,
      },
      playSessions: {
        select: { playedAt: true },
        orderBy: { playedAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          links: { where: { type: { in: shopLinkTypes } } },
          playSessions: true,
          preorders: { where: { status: { in: activePreorderStatuses } } },
          purchases: true,
        },
      },
    },
  },
} satisfies Prisma.UserItemSelect;
