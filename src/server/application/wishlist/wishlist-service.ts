import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapItemDetails,
  mapWishlistCard,
  mapWishlistCardToLegacy,
  mapWishlistItemDetail,
  type UserItemForWishlistCard,
} from "@/server/application/items/item-mappers";
import { normalizeTaxonomyName } from "@/server/application/items/taxonomy-service";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";
import type {
  ItemListDto,
  PaginatedResponse,
  WishlistCardDto,
  WishlistItemDetailsDto,
  WishlistItemDetailDto,
  WishlistQueryDto,
} from "@/shared/api";

export type WishlistQuery = WishlistQueryDto;

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
  now = new Date(),
): Promise<PaginatedResponse<WishlistCardDto>> {
  const page = await queryWishlist(query, pagination);

  return {
    ...page,
    data: page.data.map((item) => mapWishlistCard(item, now)),
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
      orderBy: buildWishlistOrder(query),
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
        owned: false,
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

export async function getWishlistItemDetail(
  itemId: string,
): Promise<WishlistItemDetailDto> {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
      userItem: { wishlist: true, owned: false },
    },
    include: itemDetailsInclude,
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Wishlist item was not found");
  }

  return mapWishlistItemDetail(asItemForDetails(item));
}

async function buildWishlistWhere(
  query: WishlistQuery,
): Promise<Prisma.UserItemWhereInput> {
  const itemAnd: Prisma.ItemWhereInput[] = [{ deletedAt: null }];

  if (query.q) {
    itemAnd.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { originalTitle: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  if (query.type) {
    itemAnd.push({ type: { code: query.type } });
  }

  if (query.ratingMin !== undefined) {
    itemAnd.push({ rating: { gte: query.ratingMin } });
  }

  if (query.players !== undefined) {
    itemAnd.push(
      { OR: [{ minPlayers: null }, { minPlayers: { lte: query.players } }] },
      { OR: [{ maxPlayers: null }, { maxPlayers: { gte: query.players } }] },
    );
  }

  if (query.playTimeMax !== undefined) {
    itemAnd.push({
      OR: [{ maxPlayTime: null }, { maxPlayTime: { lte: query.playTimeMax } }],
    });
  }

  if (query.complexityMin !== undefined || query.complexityMax !== undefined) {
    itemAnd.push({
      complexity: { gte: query.complexityMin, lte: query.complexityMax },
    });
  }

  if (query.hasLocalization !== undefined) {
    const localization: Prisma.ItemWhereInput = {
      OR: [
        { links: { some: { type: "publisher" } } },
        { originalTitle: { not: null } },
      ],
    };
    itemAnd.push(query.hasLocalization ? localization : { NOT: localization });
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

  if (query.mechanic?.length || query.category?.length) {
    const itemIds = await findTaxonomyItemIds(
      itemAnd,
      query.mechanic ?? [],
      query.category ?? [],
    );
    itemAnd.push({ id: { in: itemIds } });
  }

  return {
    wishlist: true,
    owned: false,
    interestLevel: query.interestLevel,
    item: { AND: itemAnd },
  };
}

async function findTaxonomyItemIds(
  prefilter: Prisma.ItemWhereInput[],
  mechanics: string[],
  categories: string[],
) {
  const mechanicNames = mechanics.map(normalizeTaxonomyName);
  const categoryNames = categories.map(normalizeTaxonomyName);
  const relationFilters: Prisma.ItemWhereInput[] = [];
  if (mechanics.length) {
    relationFilters.push({
      itemMechanics: {
        some: {
          mechanic: {
            OR: [
              { id: { in: mechanics } },
              { normalizedName: { in: mechanicNames } },
            ],
          },
        },
      },
    });
  }
  if (categories.length) {
    relationFilters.push({
      itemCategories: {
        some: {
          category: {
            OR: [
              { id: { in: categories } },
              { normalizedName: { in: categoryNames } },
            ],
          },
        },
      },
    });
  }

  const normalizedItems = await prisma.item.findMany({
    where: {
      AND: [...prefilter, ...relationFilters],
      userItem: { wishlist: true, owned: false },
    },
    select: { id: true },
  });

  const legacyCandidates = await prisma.item.findMany({
    where: {
      AND: prefilter,
      userItem: { wishlist: true, owned: false },
      OR: [
        ...(mechanics.length ? [{ itemMechanics: { none: {} } }] : []),
        ...(categories.length ? [{ itemCategories: { none: {} } }] : []),
      ],
    },
    select: { id: true, mechanics: true, categories: true },
  });

  const legacyIds = legacyCandidates
    .filter(
      (item) =>
        containsAny(jsonStringArray(item.mechanics), mechanics) &&
        containsAny(jsonStringArray(item.categories), categories),
    )
    .map(({ id }) => id);

  return [...new Set([...normalizedItems.map(({ id }) => id), ...legacyIds])];
}

function buildWishlistOrder(
  query: WishlistQuery,
): Prisma.UserItemOrderByWithRelationInput[] {
  const direction = query.direction ?? "desc";
  switch (query.sort) {
    case "rating":
      return [{ item: { rating: { sort: direction, nulls: direction === "asc" ? "first" : "last" } } }, { id: "asc" }];
    case "year":
      return [{ item: { year: { sort: direction, nulls: direction === "asc" ? "first" : "last" } } }, { id: "asc" }];
    case "title":
      return [{ item: { title: direction } }, { id: "asc" }];
    case "updated":
      return [{ updatedAt: direction }, { id: "asc" }];
    default:
      return [{ interestLevel: { sort: direction, nulls: direction === "asc" ? "first" : "last" } }, { id: "asc" }];
  }
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
      minAge: true,
      complexity: true,
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
      purchases: {
        select: { id: true, totalPrice: true, currency: true },
        orderBy: { totalPrice: "asc" },
        take: 1,
      },
      preorders: {
        where: { status: { in: activePreorderStatuses } },
        select: {
          id: true,
          status: true,
          expectedDate: true,
          expectedDatePrecision: true,
          price: true,
          currency: true,
        },
        orderBy: [{ expectedDate: { sort: "asc", nulls: "first" } }, { id: "asc" }],
        take: 1,
      },
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
