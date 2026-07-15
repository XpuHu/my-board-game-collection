import type { PlaySession, Preorder } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import {
  mapCollectionCard,
  mapPlayListItem,
  mapPreorderListItem,
  type ItemForCompact,
  type UserItemForCollectionCard,
} from "@/server/application/items/item-mappers";
import { userItemCardSelect } from "@/server/application/collection/collection-service";
import { playListSelect } from "@/server/application/plays/play-service";
import { preorderListSelect } from "@/server/application/preorders/preorder-service";
import type { DashboardDto } from "@/shared/api";

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];

type PlayForList = PlaySession & { item: ItemForCompact };
type PreorderForList = Preorder & { item: ItemForCompact };

export async function getDashboard(now = new Date()): Promise<DashboardDto> {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const activityFrom = new Date(now);
  activityFrom.setDate(activityFrom.getDate() - 364);

  const [
    recentPlays,
    upcomingPreorders,
    recentlyAdded,
    monthPlays,
    favoriteItems,
    activityPlays,
  ] = await prisma.$transaction([
    prisma.playSession.findMany({
      where: { item: { deletedAt: null } },
      select: playListSelect,
      orderBy: [{ playedAt: "desc" }, { id: "asc" }],
      take: 4,
    }),
    prisma.preorder.findMany({
      where: {
        status: { in: activePreorderStatuses },
        item: { deletedAt: null },
      },
      select: preorderListSelect,
      orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.userItem.findMany({
      where: { owned: true, item: { deletedAt: null } },
      select: userItemCardSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 4,
    }),
    prisma.playSession.findMany({
      where: {
        playedAt: { gte: startOfMonth, lt: startOfNextMonth },
        item: { deletedAt: null },
      },
      select: {
        itemId: true,
        durationMinutes: true,
        result: true,
      },
    }),
    prisma.userItem.findMany({
      where: {
        owned: true,
        item: { deletedAt: null },
      },
      select: userItemCardSelect,
      orderBy: [
        { personalRating: "desc" },
        { item: { playSessions: { _count: "desc" } } },
        { updatedAt: "desc" },
      ],
      take: 1,
    }),
    prisma.playSession.findMany({
      where: {
        playedAt: { gte: activityFrom, lte: now },
        item: { deletedAt: null },
      },
      select: { playedAt: true },
      orderBy: { playedAt: "asc" },
    }),
  ]);

  return {
    recentPlays: (recentPlays as PlayForList[]).map(mapPlayListItem),
    upcomingPreorders: (upcomingPreorders as PreorderForList[]).map(
      (preorder) => mapPreorderListItem(preorder, now),
    ),
    recentlyAdded: (recentlyAdded as UserItemForCollectionCard[]).map(
      mapCollectionCard,
    ),
    monthSummary: {
      playsCount: monthPlays.length,
      uniqueItemsCount: new Set(monthPlays.map(({ itemId }) => itemId)).size,
      totalDurationMinutes: monthPlays.reduce(
        (total, play) => total + (play.durationMinutes ?? 0),
        0,
      ),
      averagePersonalRating: null,
      winsCount: monthPlays.filter(({ result }) => result === "win").length,
    },
    favoriteItem: favoriteItems[0]
      ? mapCollectionCard(favoriteItems[0] as UserItemForCollectionCard)
      : null,
    activity: mapActivity(activityPlays),
  };
}

function mapActivity(plays: { playedAt: Date }[]) {
  const counts = new Map<string, number>();

  plays.forEach(({ playedAt }) => {
    const date = toLocalDateKey(playedAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  });

  return Array.from(counts, ([date, playsCount]) => ({ date, playsCount }));
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
