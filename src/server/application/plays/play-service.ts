import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePlaySessionInput,
  UpdatePlaySessionInput,
} from "@/shared/api";
import type { PaginatedResponse, PlaySessionDto } from "@/shared/api";
import { ApiError } from "@/server/api/errors";
import { paginate, type PaginationInput } from "@/server/api/pagination";
import { mapPlaySession } from "@/server/application/items/item-mappers";

export type PlaysQuery = {
  itemId?: string;
  from?: string;
  to?: string;
  source?: "manual" | "boardgamegeek";
};

export async function listPlaySessions(
  query: PlaysQuery,
  pagination: PaginationInput,
): Promise<PaginatedResponse<PlaySessionDto>> {
  const plays = await prisma.playSession.findMany({
    where: buildPlayWhere(query),
    include: {
      item: true,
    },
    orderBy: {
      playedAt: "desc",
    },
  });

  return paginate(plays.map(mapPlaySession), pagination);
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

function buildPlayWhere(query: PlaysQuery): Prisma.PlaySessionWhereInput {
  return {
    itemId: query.itemId,
    source: query.source,
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
