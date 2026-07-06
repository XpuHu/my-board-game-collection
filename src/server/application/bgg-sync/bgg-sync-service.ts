import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import {
  boardGameGeekPlayProvider,
  type NormalizedBggPlay,
} from "@/infrastructure/providers/bgg-play-provider";
import type { SyncBggPlaysInput, SyncBggPlaysResponse } from "@/shared/api";
import { ApiError } from "@/server/api/errors";

const BGG_PROVIDER = "boardgamegeek";

export async function syncBggPlays(
  input: SyncBggPlaysInput,
): Promise<SyncBggPlaysResponse> {
  const username = input.username?.trim();

  if (!username) {
    throw ApiError.badRequest("VALIDATION_ERROR", "BGG username is required");
  }

  const syncedAt = new Date();
  const providerPlays = await boardGameGeekPlayProvider.getUserPlays(
    username,
    input.since,
  );
  const plays = uniqueByBggPlayId(providerPlays);
  const existingPlayIds = await getExistingPlayIds(plays);
  const references = await getBggReferences(plays);
  const unmatched = new Map<
    string,
    { bggThingId: string; title: string; playsCount: number }
  >();
  let imported = 0;
  let skippedDuplicates = providerPlays.length - plays.length;

  for (const play of plays) {
    if (existingPlayIds.has(play.bggPlayId)) {
      skippedDuplicates += 1;
      continue;
    }

    const itemId = references.get(play.bggThingId);

    if (!itemId) {
      addUnmatched(unmatched, play);
      continue;
    }

    await createImportedPlay(itemId, play, syncedAt);
    existingPlayIds.add(play.bggPlayId);
    imported += 1;
  }

  return {
    syncedAt: syncedAt.toISOString(),
    imported,
    updated: 0,
    skippedDuplicates,
    unmatched: Array.from(unmatched.values()).sort((left, right) =>
      left.title.localeCompare(right.title, "ru"),
    ),
  };
}

async function getExistingPlayIds(plays: NormalizedBggPlay[]) {
  const bggPlayIds = plays.map((play) => play.bggPlayId);

  if (bggPlayIds.length === 0) {
    return new Set<string>();
  }

  const existing = await prisma.playSession.findMany({
    where: {
      bggPlayId: {
        in: bggPlayIds,
      },
    },
    select: {
      bggPlayId: true,
    },
  });

  return new Set(
    existing
      .map((play) => play.bggPlayId)
      .filter((id): id is string => Boolean(id)),
  );
}

async function getBggReferences(plays: NormalizedBggPlay[]) {
  const bggThingIds = Array.from(new Set(plays.map((play) => play.bggThingId)));

  if (bggThingIds.length === 0) {
    return new Map<string, string>();
  }

  const references = await prisma.externalReference.findMany({
    where: {
      provider: BGG_PROVIDER,
      externalId: {
        in: bggThingIds,
      },
      item: {
        deletedAt: null,
      },
    },
    select: {
      externalId: true,
      itemId: true,
    },
  });

  return new Map(
    references.map((reference) => [reference.externalId, reference.itemId]),
  );
}

async function createImportedPlay(
  itemId: string,
  play: NormalizedBggPlay,
  importedAt: Date,
) {
  try {
    await prisma.playSession.create({
      data: {
        itemId,
        playedAt: play.playedAt,
        playersCount: play.playersCount,
        durationMinutes: play.durationMinutes,
        result: play.result,
        score: play.score,
        playerNames: play.playerNames,
        usedItemIds: [],
        notes: play.notes,
        source: BGG_PROVIDER,
        bggPlayId: play.bggPlayId,
        importedAt,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }

    throw error;
  }
}

function addUnmatched(
  unmatched: Map<
    string,
    { bggThingId: string; title: string; playsCount: number }
  >,
  play: NormalizedBggPlay,
) {
  const existing = unmatched.get(play.bggThingId);

  if (existing) {
    existing.playsCount += play.quantity;
    return;
  }

  unmatched.set(play.bggThingId, {
    bggThingId: play.bggThingId,
    title: play.title,
    playsCount: play.quantity,
  });
}

function uniqueByBggPlayId(plays: NormalizedBggPlay[]) {
  const seen = new Set<string>();
  const unique: NormalizedBggPlay[] = [];

  for (const play of plays) {
    if (seen.has(play.bggPlayId)) {
      continue;
    }

    seen.add(play.bggPlayId);
    unique.push(play);
  }

  return unique;
}
