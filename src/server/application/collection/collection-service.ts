import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapCollectionCard,
  mapCollectionCardToLegacy,
  mapItemDetails,
  mapPlaySession,
  type UserItemForCollectionCard,
} from "@/server/application/items/item-mappers";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";
import type {
  CollectionCardDto,
  CollectionItemDetailsDto,
  CollectionQueryDto,
  ItemListDto,
  PaginatedResponse,
} from "@/shared/api";

export type CollectionQuery = CollectionQueryDto & {
  /** @deprecated Use personalRating. */
  rating?: number;
  /** @deprecated Use lastPlayedFrom. */
  playedFrom?: string;
  /** @deprecated Use lastPlayedTo. */
  playedTo?: string;
};

export async function listCollection(
  query: CollectionQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<ItemListDto>> {
  const page = await queryCollection(query, pagination);

  return {
    ...page,
    data: page.data.map(mapCollectionCardToLegacy),
  };
}

export async function listCollectionCards(
  query: CollectionQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<CollectionCardDto>> {
  const page = await queryCollection(query, pagination);

  return {
    ...page,
    data: page.data.map(mapCollectionCard),
  };
}

async function queryCollection(
  query: CollectionQuery,
  pagination: PaginationInput,
) {
  const where = await buildCollectionWhere(query);
  const { page, pageSize } = pagination;

  if (query.sort === "lastPlayed") {
    const total = await prisma.userItem.count({ where });
    const pageIds = await findLastPlayedPageIds(
      where,
      pagination,
      query.direction ?? "desc",
    );
    const userItems = await prisma.userItem.findMany({
      where: { id: { in: pageIds } },
      select: userItemCardSelect,
    });
    const positions = new Map(pageIds.map((id, index) => [id, index]));
    userItems.sort(
      (left, right) =>
        (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );

    return {
      data: userItems as UserItemForCollectionCard[],
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  const [total, userItems] = await prisma.$transaction([
    prisma.userItem.count({ where }),
    prisma.userItem.findMany({
      where,
      select: userItemCardSelect,
      orderBy: buildCollectionOrder(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: userItems as UserItemForCollectionCard[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
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

  const detailsItem = asItemForDetails(item);
  const details = mapItemDetails(detailsItem);

  return {
    ...details,
    recentPlays: detailsItem.playSessions
      .slice(0, 5)
      .map((playSession) =>
        mapPlaySession({ ...playSession, item: detailsItem }),
      ),
    primaryAction: "add_play",
  };
}

async function buildCollectionWhere(
  query: CollectionQuery,
): Promise<Prisma.UserItemWhereInput> {
  const itemAnd: Prisma.ItemWhereInput[] = [{ deletedAt: null }];
  const personalRating = query.personalRating ?? query.rating;
  const lastPlayedFrom = query.lastPlayedFrom ?? query.playedFrom;
  const lastPlayedTo = query.lastPlayedTo ?? query.playedTo;

  if (query.q) {
    itemAnd.push({
      OR: [
        { title: { contains: query.q } },
        { originalTitle: { contains: query.q } },
      ],
    });
  }

  if (query.type) {
    itemAnd.push({ type: { code: query.type } });
  }

  if (query.tag) {
    itemAnd.push({
      tags: {
        some: {
          OR: [{ id: query.tag }, { name: { contains: query.tag } }],
        },
      },
    });
  }

  if (query.hasActivePreorder !== undefined) {
    itemAnd.push({
      preorders: query.hasActivePreorder
        ? { some: { status: { in: activePreorderStatuses } } }
        : { none: { status: { in: activePreorderStatuses } } },
    });
  }

  if (query.hasExpansions !== undefined) {
    const expansionRelation: Prisma.ItemWhereInput = {
      OR: [
        { parentRelations: { some: { relationType: "expands" } } },
        { childRelations: { some: { relationType: "expands" } } },
      ],
    };
    itemAnd.push(
      query.hasExpansions ? expansionRelation : { NOT: expansionRelation },
    );
  }

  if (query.neverPlayed !== undefined) {
    itemAnd.push({
      playSessions: query.neverPlayed ? { none: {} } : { some: {} },
    });
  }

  if (query.notPlayedSince) {
    itemAnd.push({
      playSessions: {
        none: { playedAt: { gte: new Date(query.notPlayedSince) } },
      },
    });
  }

  if (lastPlayedFrom || lastPlayedTo) {
    const itemIds = await findItemIdsByLastPlay(lastPlayedFrom, lastPlayedTo);
    itemAnd.push({ id: { in: itemIds } });
  }

  if (query.playsMin !== undefined || query.playsMax !== undefined) {
    const itemIds = await findItemIdsByPlayCount(
      query.playsMin,
      query.playsMax,
    );
    itemAnd.push({ id: { in: itemIds } });
  }

  // DATA-02 is intentionally outside this read-only stage. Until the
  // persistent flag exists, every current record has the safe default false.
  if (query.favorite === true) {
    itemAnd.push({ id: { in: [] } });
  }

  return {
    owned: true,
    personalRating,
    location: query.location ? { contains: query.location } : undefined,
    item: { AND: itemAnd },
  };
}

async function findItemIdsByPlayCount(min?: number, max?: number) {
  const [counts, unplayed] = await Promise.all([
    prisma.playSession.groupBy({
      by: ["itemId"],
      _count: { _all: true },
    }),
    min === undefined || min <= 0
      ? prisma.item.findMany({
          where: { playSessions: { none: {} } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...counts
      .filter(({ _count }) => {
        const count = _count._all;
        return (
          (min === undefined || count >= min) &&
          (max === undefined || count <= max)
        );
      })
      .map(({ itemId }) => itemId),
    ...unplayed.map(({ id }) => id),
  ];
}

async function findItemIdsByLastPlay(from?: string, to?: string) {
  const groups = await prisma.playSession.groupBy({
    by: ["itemId"],
    _max: { playedAt: true },
  });
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  return groups
    .filter(({ _max }) => {
      const lastPlayedAt = _max.playedAt;
      return Boolean(
        lastPlayedAt &&
        (!fromDate || lastPlayedAt >= fromDate) &&
        (!toDate || lastPlayedAt <= toDate),
      );
    })
    .map(({ itemId }) => itemId);
}

async function findLastPlayedPageIds(
  where: Prisma.UserItemWhereInput,
  pagination: PaginationInput,
  direction: "asc" | "desc",
) {
  const candidates = await prisma.userItem.findMany({
    where,
    select: { id: true },
  });

  if (candidates.length === 0) {
    return [];
  }

  const ids = candidates.map(({ id }) => id);
  const order = Prisma.raw(direction === "asc" ? "ASC" : "DESC");
  const offset = (pagination.page - 1) * pagination.pageSize;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT ui.id
    FROM user_items AS ui
    LEFT JOIN play_sessions AS ps ON ps.item_id = ui.item_id
    WHERE ui.id IN (${Prisma.join(ids)})
    GROUP BY ui.id
    ORDER BY MAX(ps.played_at) ${order}, ui.id ASC
    LIMIT ${pagination.pageSize} OFFSET ${offset}
  `);

  return rows.map(({ id }) => id);
}

function buildCollectionOrder(
  query: CollectionQuery,
): Prisma.UserItemOrderByWithRelationInput[] {
  const direction = query.direction ?? "desc";

  switch (query.sort) {
    case "added":
      return [{ createdAt: direction }, { id: "asc" }];
    case "plays":
      return [{ item: { playSessions: { _count: direction } } }, { id: "asc" }];
    case "rating":
      return [{ personalRating: direction }, { id: "asc" }];
    case "title":
      return [{ item: { title: direction } }, { id: "asc" }];
    case "lastPlayed":
      return [{ id: "asc" }];
    default:
      return [{ updatedAt: "desc" }, { id: "asc" }];
  }
}

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];
const expansionRelationTypes = ["expands"];

export const userItemCardSelect = {
  id: true,
  status: true,
  owned: true,
  wishlist: true,
  personalRating: true,
  location: true,
  interestLevel: true,
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
      updatedAt: true,
      type: true,
      tags: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      playSessions: {
        select: { playedAt: true },
        orderBy: { playedAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          playSessions: true,
          preorders: { where: { status: { in: activePreorderStatuses } } },
          purchases: true,
          parentRelations: {
            where: { relationType: { in: expansionRelationTypes } },
          },
          childRelations: {
            where: { relationType: { in: expansionRelationTypes } },
          },
        },
      },
    },
  },
} satisfies Prisma.UserItemSelect;
