import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapCollectionCard,
  mapCollectionCardToLegacy,
  mapCollectionItemDetail,
  mapItemDetails,
  mapPlayListItem,
  mapPlaySession,
  type ItemForCompact,
  type UserItemForCollectionCard,
} from "@/server/application/items/item-mappers";
import {
  asItemForDetails,
  itemDetailsInclude,
} from "@/server/application/items/item-service";
import { playListSelect } from "@/server/application/plays/play-service";
import type {
  CollectionCardDto,
  CollectionItemDetailDto,
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
  now = new Date(),
): Promise<PaginatedResponse<CollectionCardDto>> {
  const page = await queryCollection(query, pagination);

  return {
    ...page,
    data: page.data.map((item) => mapCollectionCard(item, now)),
  };
}

async function queryCollection(
  query: CollectionQuery,
  pagination: PaginationInput,
) {
  const { page, pageSize } = pagination;
  const matches = buildCollectionMatchesSql(query);
  const order = collectionOrderSql(query);
  const offset = (page - 1) * pageSize;
  const [countRows, pageRows] = await prisma.$transaction([
    prisma.$queryRaw<{ total: bigint | number }[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM (${matches}) AS collection_matches
    `),
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM (${matches}) AS collection_matches
      ORDER BY ${order}, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  const pageIds = pageRows.map(({ id }) => id);
  const userItems = pageIds.length
    ? await prisma.userItem.findMany({
        where: { id: { in: pageIds } },
        select: userItemCardSelect,
      })
    : [];
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

export async function getCollectionItemDetail(
  itemId: string,
): Promise<CollectionItemDetailDto> {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
      userItem: { owned: true },
    },
    include: itemDetailsInclude,
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Collection item was not found");
  }

  const detailsItem = asItemForDetails(item);
  const recent = detailsItem.playSessions.slice(0, 5);
  const usedIds = [
    ...new Set(recent.flatMap((play) => jsonStringArray(play.usedItemIds))),
  ];
  const usedItems = usedIds.length
    ? await prisma.item.findMany({
        where: { id: { in: usedIds }, deletedAt: null },
        select: playListSelect.item.select,
      })
    : [];
  const usedById = new Map(
    (usedItems as ItemForCompact[]).map((usedItem) => [usedItem.id, usedItem]),
  );
  const recentPlays = recent.map((play) =>
    mapPlayListItem(
      { ...play, item: detailsItem },
      jsonStringArray(play.usedItemIds).flatMap((id) => {
        const usedItem = usedById.get(id);
        return usedItem ? [usedItem] : [];
      }),
    ),
  );

  return mapCollectionItemDetail(detailsItem, recentPlays);
}

function buildCollectionMatchesSql(query: CollectionQuery) {
  const where: Prisma.Sql[] = [
    Prisma.sql`ui.owned = 1`,
    Prisma.sql`i.deleted_at IS NULL`,
  ];
  const having: Prisma.Sql[] = [];
  const personalRating = query.personalRating ?? query.rating;
  const lastPlayedFrom = query.lastPlayedFrom ?? query.playedFrom;
  const lastPlayedTo = query.lastPlayedTo ?? query.playedTo;

  if (query.q) {
    const pattern = `%${query.q}%`;
    where.push(Prisma.sql`(i.title LIKE ${pattern} OR i.original_title LIKE ${pattern})`);
  }

  if (query.type) {
    where.push(Prisma.sql`it.code = ${query.type}`);
  }

  if (query.tag?.length) {
    for (const tag of query.tag) {
      const pattern = `%${tag}%`;
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "_ItemTags" AS item_tags
        JOIN tags AS tag ON tag.id = item_tags."B"
        WHERE item_tags."A" = i.id
          AND (tag.id = ${tag} OR tag.name LIKE ${pattern})
      )`);
    }
  }

  if (query.hasActivePreorder !== undefined) {
    const exists = Prisma.sql`EXISTS (
      SELECT 1 FROM preorders AS active_preorder
      WHERE active_preorder.item_id = i.id
        AND active_preorder.status IN ('planned', 'ordered', 'paid', 'shipped')
    )`;
    where.push(query.hasActivePreorder ? exists : Prisma.sql`NOT ${exists}`);
  }

  if (query.hasExpansions !== undefined) {
    const exists = Prisma.sql`EXISTS (
      SELECT 1 FROM item_relations AS expansion
      WHERE expansion.relation_type = 'expands'
        AND (expansion.parent_item_id = i.id OR expansion.child_item_id = i.id)
    )`;
    where.push(query.hasExpansions ? exists : Prisma.sql`NOT ${exists}`);
  }

  if (query.neverPlayed === true) {
    having.push(Prisma.sql`COUNT(ps.id) = 0`);
  } else if (query.neverPlayed === false) {
    having.push(Prisma.sql`COUNT(ps.id) > 0`);
  }

  if (query.notPlayedSince) {
    where.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM play_sessions AS recent_play
      WHERE recent_play.item_id = i.id
        AND recent_play.played_at >= ${new Date(`${query.notPlayedSince}T00:00:00.000Z`)}
    )`);
  }

  if (lastPlayedFrom) having.push(Prisma.sql`MAX(ps.played_at) >= ${new Date(`${lastPlayedFrom}T00:00:00.000Z`)}`);
  if (lastPlayedTo) having.push(Prisma.sql`MAX(ps.played_at) <= ${endOfDay(lastPlayedTo)}`);
  if (query.playsMin !== undefined) having.push(Prisma.sql`COUNT(ps.id) >= ${query.playsMin}`);
  if (query.playsMax !== undefined) having.push(Prisma.sql`COUNT(ps.id) <= ${query.playsMax}`);

  if (query.favorite !== undefined) {
    where.push(Prisma.sql`ui.favorite = ${query.favorite}`);
  }

  if (personalRating !== undefined) where.push(Prisma.sql`ui.personal_rating = ${personalRating}`);
  if (query.location) where.push(Prisma.sql`ui.location LIKE ${`%${query.location}%`}`);

  const havingSql = having.length
    ? Prisma.sql`HAVING ${Prisma.join(having, " AND ")}`
    : Prisma.empty;
  return Prisma.sql`
    SELECT
      ui.id AS id,
      ui.owned_at AS added_at,
      i.title AS title,
      ui.personal_rating AS personal_rating,
      COUNT(ps.id) AS plays_count,
      MAX(ps.played_at) AS last_played_at
    FROM user_items AS ui
    JOIN items AS i ON i.id = ui.item_id
    JOIN item_types AS it ON it.id = i.type_id
    LEFT JOIN play_sessions AS ps ON ps.item_id = i.id
    WHERE ${Prisma.join(where, " AND ")}
    GROUP BY ui.id
    ${havingSql}
  `;
}

function collectionOrderSql(query: CollectionQuery) {
  const direction = query.direction ?? "desc";
  const field = query.sort === "lastPlayed"
    ? "last_played_at"
    : query.sort === "plays"
      ? "plays_count"
      : query.sort === "rating"
        ? "personal_rating"
        : query.sort === "title"
          ? "title COLLATE NOCASE"
          : "added_at";
  return Prisma.raw(`${field} ${direction === "asc" ? "ASC" : "DESC"}`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];
const expansionRelationTypes = ["expands"];

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export const userItemCardSelect = {
  id: true,
  status: true,
  owned: true,
  wishlist: true,
  favorite: true,
  personalRating: true,
  location: true,
  interestLevel: true,
  ownedAt: true,
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
      updatedAt: true,
      type: true,
      tags: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      playSessions: {
        select: { playedAt: true, result: true },
        orderBy: { playedAt: "desc" },
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
        orderBy: [{ expectedDate: "asc" }, { id: "asc" }],
        take: 1,
      },
      purchases: {
        select: { totalPrice: true, currency: true },
      },
      _count: {
        select: {
          playSessions: true,
          preorders: { where: { status: { in: activePreorderStatuses } } },
          purchases: true,
          images: true,
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
