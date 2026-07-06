import type {
  ItemListDto,
  PaginatedResponse,
  WishlistItemDetailsDto,
} from "@/shared/api";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import { paginate, type PaginationInput } from "@/server/api/pagination";
import {
  mapItemDetails,
  mapItemList,
  type UserItemForList,
} from "@/server/application/items/item-mappers";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";

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
  const userItems = await prisma.userItem.findMany({
    where: {
      wishlist: true,
      item: {
        deletedAt: null,
      },
    },
    include: userItemListInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });

  const filtered = userItems.filter((userItem) =>
    matchesWishlistQuery(userItem as UserItemForList, query),
  );

  return paginate(
    filtered.map((userItem) => mapItemList(userItem)),
    pagination,
  );
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

function matchesWishlistQuery(userItem: UserItemForList, query: WishlistQuery) {
  const item = userItem.item;

  if (query.q && !matchesSearch(item.title, item.originalTitle, query.q)) {
    return false;
  }

  if (query.minRating !== undefined && Number(item.rating) < query.minRating) {
    return false;
  }

  if (query.players !== undefined && !matchesPlayers(item, query.players)) {
    return false;
  }

  if (
    query.maxPlayTime !== undefined &&
    item.maxPlayTime !== null &&
    item.maxPlayTime > query.maxPlayTime
  ) {
    return false;
  }

  if (
    query.hasPrice !== undefined &&
    hasPriceSignals(item) !== query.hasPrice
  ) {
    return false;
  }

  if (
    query.mechanics?.length &&
    !containsAny(jsonStringArray(item.mechanics), query.mechanics)
  ) {
    return false;
  }

  if (
    query.categories?.length &&
    !containsAny(jsonStringArray(item.categories), query.categories)
  ) {
    return false;
  }

  return true;
}

function matchesSearch(title: string, originalTitle: string | null, q: string) {
  const query = q.toLowerCase();

  return (
    title.toLowerCase().includes(query) ||
    Boolean(originalTitle?.toLowerCase().includes(query))
  );
}

function matchesPlayers(item: UserItemForList["item"], players: number) {
  if (item.minPlayers !== null && item.minPlayers > players) {
    return false;
  }

  if (item.maxPlayers !== null && item.maxPlayers < players) {
    return false;
  }

  return true;
}

function hasPriceSignals(item: UserItemForList["item"]) {
  return (
    item.purchases.length > 0 ||
    item.preorders.length > 0 ||
    (item.links ?? []).some((link) => link.type === "shop")
  );
}

function containsAny(values: string[], queryValues: string[]) {
  const normalized = values.map((value) => value.toLowerCase());

  return queryValues.some((queryValue) =>
    normalized.includes(queryValue.toLowerCase()),
  );
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

const userItemListInclude = {
  item: {
    include: {
      type: true,
      images: {
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
      links: true,
      playSessions: true,
      preorders: true,
      purchases: true,
      tags: true,
    },
  },
} satisfies Prisma.UserItemInclude;
