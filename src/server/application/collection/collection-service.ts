import type {
  CollectionItemDetailsDto,
  ItemListDto,
  PaginatedResponse,
} from "@/shared/api";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import { paginate, type PaginationInput } from "@/server/api/pagination";
import {
  mapItemDetails,
  mapItemList,
  mapPlaySession,
  type UserItemForList,
} from "@/server/application/items/item-mappers";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";

export type CollectionQuery = {
  q?: string;
  type?: string;
  rating?: number;
  location?: string;
  playedFrom?: string;
  playedTo?: string;
  hasActivePreorder?: boolean;
  tag?: string;
};

export async function listCollection(
  query: CollectionQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<ItemListDto>> {
  const userItems = await prisma.userItem.findMany({
    where: {
      owned: true,
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
    matchesCollectionQuery(userItem as UserItemForList, query),
  );

  return paginate(
    filtered.map((userItem) => mapItemList(userItem)),
    pagination,
  );
}

export async function getCollectionItem(
  itemId: string,
): Promise<CollectionItemDetailsDto> {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
      userItem: {
        owned: true,
      },
    },
    include: itemDetailsInclude,
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Collection item was not found");
  }

  const details = mapItemDetails(asItemForDetails(item));

  return {
    ...details,
    recentPlays: asItemForDetails(item)
      .playSessions.slice(0, 5)
      .map((playSession) =>
        mapPlaySession({ ...playSession, item: asItemForDetails(item) }),
      ),
    primaryAction: "add_play",
  };
}

function matchesCollectionQuery(
  userItem: UserItemForList,
  query: CollectionQuery,
) {
  const item = userItem.item;

  if (query.q && !matchesSearch(item.title, item.originalTitle, query.q)) {
    return false;
  }

  if (query.type && item.type.code !== query.type) {
    return false;
  }

  if (query.rating !== undefined && userItem.personalRating !== query.rating) {
    return false;
  }

  if (
    query.location &&
    !userItem.location?.toLowerCase().includes(query.location.toLowerCase())
  ) {
    return false;
  }

  if (query.tag && !matchesTag(item.tags, query.tag)) {
    return false;
  }

  if (
    query.hasActivePreorder !== undefined &&
    hasActivePreorder(item.preorders) !== query.hasActivePreorder
  ) {
    return false;
  }

  if (query.playedFrom || query.playedTo) {
    return item.playSessions.some((playSession) =>
      matchesPlayedRange(
        playSession.playedAt,
        query.playedFrom,
        query.playedTo,
      ),
    );
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

function matchesTag(tags: UserItemForList["item"]["tags"], tag: string) {
  const query = tag.toLowerCase();

  return tags.some(
    (itemTag) =>
      itemTag.id === tag || itemTag.name.toLowerCase().includes(query),
  );
}

function matchesPlayedRange(playedAt: Date, from?: string, to?: string) {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (fromDate && playedAt < fromDate) {
    return false;
  }

  if (toDate && playedAt > toDate) {
    return false;
  }

  return true;
}

function hasActivePreorder(preorders: UserItemForList["item"]["preorders"]) {
  return preorders.some(
    (preorder) =>
      preorder.status !== "received" && preorder.status !== "cancelled",
  );
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
      playSessions: true,
      preorders: true,
      purchases: true,
      tags: true,
    },
  },
} satisfies Prisma.UserItemInclude;
