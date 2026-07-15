import type { PlaySession } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  mapPlayListItem,
  mapPlaySession,
  type ItemForCompact,
} from "@/server/application/items/item-mappers";
import type {
  CreatePlaySessionInput,
  PaginatedResponse,
  PlayListItemDto,
  PlaySessionDto,
  PlaysQueryDto,
  UpdatePlaySessionInput,
} from "@/shared/api";

export type PlaysQuery = PlaysQueryDto;

type PlayForList = PlaySession & { item: ItemForCompact };

export async function listPlaySessions(
  query: PlaysQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<PlaySessionDto>> {
  const page = await queryPlaySessions(query, pagination);

  return {
    ...page,
    data: page.data.map(mapPlaySession),
  };
}

export async function listPlayItems(
  query: PlaysQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<PlayListItemDto>> {
  const page = await queryPlaySessions(query, pagination);

  return {
    ...page,
    data: page.data.map(mapPlayListItem),
  };
}

async function queryPlaySessions(
  query: PlaysQuery,
  pagination: PaginationInput,
) {
  const where = await buildPlayWhere(query);
  const { page, pageSize } = pagination;
  const [total, plays] = await prisma.$transaction([
    prisma.playSession.count({ where }),
    prisma.playSession.findMany({
      where,
      select: playListSelect,
      orderBy: [{ playedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: plays as PlayForList[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function createPlaySession(
  itemId: string,
  input: CreatePlaySessionInput,
): Promise<PlaySessionDto> {
  await assertItemExists(itemId);

  const playSession = await prisma.playSession.create({
    data: {
      itemId,
      playedAt: new Date(input.playedAt),
      playersCount: input.playersCount,
      durationMinutes: input.durationMinutes,
      result: input.result,
      score: input.score,
      scenario: input.scenario,
      playerNames: input.playerNames ?? [],
      usedItemIds: input.usedItemIds ?? [],
      notes: input.notes,
      source: "manual",
    },
    include: {
      item: true,
    },
  });

  return mapPlaySession(playSession);
}

export async function updatePlaySession(
  playId: string,
  input: UpdatePlaySessionInput,
): Promise<PlaySessionDto> {
  await assertPlaySessionExists(playId);

  const playSession = await prisma.playSession.update({
    where: {
      id: playId,
    },
    data: {
      playedAt: input.playedAt ? new Date(input.playedAt) : undefined,
      playersCount: input.playersCount,
      durationMinutes: input.durationMinutes,
      result: input.result,
      score: input.score,
      scenario: input.scenario,
      playerNames: input.playerNames,
      usedItemIds: input.usedItemIds,
      notes: input.notes,
      locallyModifiedAt: new Date(),
    },
    include: {
      item: true,
    },
  });

  return mapPlaySession(playSession);
}

export async function deletePlaySession(playId: string) {
  await assertPlaySessionExists(playId);

  await prisma.playSession.delete({
    where: {
      id: playId,
    },
  });
}

async function buildPlayWhere(
  query: PlaysQuery,
): Promise<Prisma.PlaySessionWhereInput> {
  const where: Prisma.PlaySessionWhereInput = {
    itemId: query.itemId,
    result: query.result,
    source: query.source,
    playersCount:
      query.playersMin !== undefined || query.playersMax !== undefined
        ? { gte: query.playersMin, lte: query.playersMax }
        : undefined,
    durationMinutes:
      query.durationMin !== undefined || query.durationMax !== undefined
        ? { gte: query.durationMin, lte: query.durationMax }
        : undefined,
    playedAt:
      query.from || query.to
        ? {
            gte: query.from ? new Date(query.from) : undefined,
            lte: query.to ? new Date(query.to) : undefined,
          }
        : undefined,
    item: {
      deletedAt: null,
    },
  };

  if (query.playerName || query.usedItemId) {
    const candidateIds = await findJsonFilteredPlayIds(where, query);
    where.id = { in: candidateIds };
  }

  return where;
}

async function findJsonFilteredPlayIds(
  where: Prisma.PlaySessionWhereInput,
  query: PlaysQuery,
) {
  const plays = await prisma.playSession.findMany({
    where,
    select: { id: true, playerNames: true, usedItemIds: true },
  });
  const playerName = query.playerName?.trim().toLowerCase();

  return plays
    .filter((play) => {
      const matchesPlayer = playerName
        ? jsonStringArray(play.playerNames).some((name) =>
            name.toLowerCase().includes(playerName),
          )
        : true;
      const matchesUsedItem = query.usedItemId
        ? jsonStringArray(play.usedItemIds).includes(query.usedItemId)
        : true;
      return matchesPlayer && matchesUsedItem;
    })
    .map(({ id }) => id);
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
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

async function assertPlaySessionExists(playId: string) {
  const playSession = await prisma.playSession.findUnique({
    where: {
      id: playId,
    },
    select: {
      id: true,
    },
  });

  if (!playSession) {
    throw ApiError.notFound(
      "PLAY_SESSION_NOT_FOUND",
      "Play session was not found",
    );
  }
}

export const playListSelect = {
  id: true,
  itemId: true,
  playedAt: true,
  playersCount: true,
  durationMinutes: true,
  result: true,
  score: true,
  scenario: true,
  playerNames: true,
  usedItemIds: true,
  notes: true,
  source: true,
  bggPlayId: true,
  locallyModifiedAt: true,
  importedAt: true,
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
} satisfies Prisma.PlaySessionSelect;
