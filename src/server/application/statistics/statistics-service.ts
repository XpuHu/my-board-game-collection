import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  ItemListDto,
  MoneyAmountDto,
  PlayResult,
  StatisticsOverviewDto,
  StatisticsQueryDto,
  StatisticsSummaryDto,
} from "@/shared/api";
import {
  mapCollectionCard,
  mapItemList,
  mapPlaySession,
  type UserItemForCollectionCard,
  type UserItemForList,
} from "@/server/application/items/item-mappers";
import { userItemCardSelect } from "@/server/application/collection/collection-service";

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];

export async function getStatisticsSummary(): Promise<StatisticsSummaryDto> {
  const [plays, ownedItems, wishlistTotal, activePreorders] = await Promise.all(
    [
      prisma.playSession.findMany({
        where: {
          item: {
            deletedAt: null,
          },
        },
        include: {
          item: true,
        },
        orderBy: {
          playedAt: "desc",
        },
      }),
      prisma.userItem.findMany({
        where: {
          owned: true,
          item: {
            deletedAt: null,
          },
        },
        include: userItemListInclude,
      }),
      prisma.userItem.count({
        where: {
          wishlist: true,
          item: {
            deletedAt: null,
          },
        },
      }),
      prisma.preorder.findMany({
        where: {
          status: {
            in: activePreorderStatuses,
          },
          item: {
            deletedAt: null,
          },
        },
      }),
    ],
  );

  const ownedList = ownedItems.map((userItem) =>
    mapItemList(userItem as UserItemForList),
  );

  return {
    playsTotal: plays.length,
    playsThisMonth: countPlaysThisMonth(plays),
    favoriteItem: getFavoriteItem(ownedList),
    mostPlayedItems: getMostPlayedItems(ownedList),
    latestPlays: plays.slice(0, 8).map(mapPlaySession),
    playCountByYear: getPlayCountByYear(plays),
    averagePlayDurationMinutes: getAveragePlayDuration(plays),
    itemsTotal: ownedItems.length,
    wishlistTotal,
    collectionValue: getCollectionValue(ownedItems as UserItemForList[]),
    preorderValue: sumMoney(
      activePreorders.map((preorder) => ({
        amount: Number(preorder.price) + Number(preorder.deliveryCost ?? 0),
        currency: preorder.currency,
      })),
    ),
  };
}

export async function getStatisticsOverview(
  queryOrNow: StatisticsQueryDto | Date = {},
  requestedNow = new Date(),
): Promise<StatisticsOverviewDto> {
  const query: StatisticsQueryDto =
    queryOrNow instanceof Date ? { period: "all" } : queryOrNow;
  const now = queryOrNow instanceof Date ? queryOrNow : requestedNow;
  const staleSince = new Date(now);
  staleSince.setDate(staleSince.getDate() - 180);

  const playedAt = statisticsDateRange(query, now);
  const [summary, plays, ratingAggregate, staleItems] = await Promise.all([
    getStatisticsSummary(),
    prisma.playSession.findMany({
      where: { item: { deletedAt: null }, playedAt },
      include: { item: { select: { title: true } } },
      orderBy: { playedAt: "asc" },
    }),
    prisma.userItem.aggregate({
      where: {
        owned: true,
        personalRating: { not: null },
        item: { deletedAt: null },
      },
      _avg: { personalRating: true },
    }),
    prisma.userItem.findMany({
      where: {
        owned: true,
        item: {
          deletedAt: null,
          playSessions: { none: { playedAt: { gte: staleSince } } },
        },
      },
      select: userItemCardSelect,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 8,
    }),
  ]);

  const knownResults = plays.filter(
    ({ result }) => result === "win" || result === "loss",
  );
  const wins = knownResults.filter(({ result }) => result === "win").length;
  const periodTopItems = await getPeriodTopItems(plays);

  return {
    ...summary,
    playsTotal: plays.length,
    playsThisMonth: countPlaysThisMonth(plays),
    latestPlays: [...plays]
      .sort((left, right) => right.playedAt.getTime() - left.playedAt.getTime())
      .slice(0, 8)
      .map(mapPlaySession),
    averagePlayDurationMinutes: getAveragePlayDuration(plays),
    mostPlayedItems: periodTopItems,
    uniquePlayedItems: new Set(plays.map(({ itemId }) => itemId)).size,
    totalPlayHours: roundOneDecimal(
      plays.reduce(
        (total, { durationMinutes }) => total + (durationMinutes ?? 0),
        0,
      ) / 60,
    ),
    averagePersonalRating: ratingAggregate._avg.personalRating,
    winRate:
      knownResults.length > 0
        ? roundOneDecimal((wins / knownResults.length) * 100)
        : null,
    playsByMonth: countByMonth(plays),
    playerCountDistribution: countByPlayers(plays),
    results: countByResult(plays),
    activityByWeekday: countByWeekday(plays),
    staleItems: (staleItems as UserItemForCollectionCard[]).map((item) =>
      mapCollectionCard(item, now),
    ),
    expansionUsage: await getExpansionUsage(plays),
    frequentPlayers: getFrequentPlayers(plays),
  };
}

async function getPeriodTopItems(plays: { itemId: string; playedAt: Date }[]) {
  const aggregate = new Map<string, { count: number; lastPlayedAt: Date }>();
  plays.forEach(({ itemId, playedAt }) => {
    const current = aggregate.get(itemId);
    aggregate.set(itemId, {
      count: (current?.count ?? 0) + 1,
      lastPlayedAt:
        !current || playedAt > current.lastPlayedAt
          ? playedAt
          : current.lastPlayedAt,
    });
  });
  const itemIds = [...aggregate]
    .sort(
      ([leftId, left], [rightId, right]) =>
        right.count - left.count || leftId.localeCompare(rightId),
    )
    .slice(0, 5)
    .map(([itemId]) => itemId);
  if (!itemIds.length) return [];

  const userItems = await prisma.userItem.findMany({
    where: { owned: true, itemId: { in: itemIds } },
    include: userItemListInclude,
  });
  const mapped = new Map(
    userItems.map((userItem) => {
      const item = mapItemList(userItem as UserItemForList);
      const period = aggregate.get(userItem.itemId);
      return [
        userItem.itemId,
        {
          ...item,
          playsCount: period?.count ?? 0,
          lastPlayedAt: period?.lastPlayedAt.toISOString() ?? null,
        },
      ] as const;
    }),
  );
  return itemIds.flatMap((itemId) => {
    const item = mapped.get(itemId);
    return item ? [item] : [];
  });
}

function statisticsDateRange(
  query: StatisticsQueryDto,
  now: Date,
): Prisma.DateTimeFilter | undefined {
  const period = query.period ?? "month";
  if (period === "all") return undefined;
  if (period === "custom") {
    return {
      gte: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
      lte: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
    };
  }

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === "month") from.setDate(1);
  if (period === "quarter") {
    from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
  }
  if (period === "year") from.setMonth(0, 1);
  return { gte: from, lte: now };
}

function countPlaysThisMonth(plays: { playedAt: Date }[]) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return plays.filter(
    (play) => play.playedAt >= startOfMonth && play.playedAt < startOfNextMonth,
  ).length;
}

function getFavoriteItem(items: ItemListDto[]) {
  const ratedItems = [...items].filter(
    (entry) => entry.userItem.personalRating !== null,
  );
  const candidates = ratedItems.length > 0 ? ratedItems : [...items];

  return (
    candidates.sort((left, right) => {
      const ratingDiff =
        (right.userItem.personalRating ?? 0) -
        (left.userItem.personalRating ?? 0);

      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return right.playsCount - left.playsCount;
    })[0] ?? null
  );
}

function getMostPlayedItems(items: ItemListDto[]) {
  return [...items]
    .filter((entry) => entry.playsCount > 0)
    .sort((left, right) => {
      const playDiff = right.playsCount - left.playsCount;

      if (playDiff !== 0) {
        return playDiff;
      }

      return left.item.title.localeCompare(right.item.title, "ru");
    })
    .slice(0, 5);
}

function getPlayCountByYear(plays: { playedAt: Date }[]) {
  const byYear = new Map<number, number>();

  plays.forEach((play) => {
    const year = play.playedAt.getFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  });

  return Array.from(byYear.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((left, right) => left.year - right.year);
}

function getAveragePlayDuration(plays: { durationMinutes: number | null }[]) {
  const durations = plays
    .map((play) => play.durationMinutes)
    .filter((duration): duration is number => duration !== null);

  if (durations.length === 0) {
    return null;
  }

  return Math.round(
    durations.reduce((total, duration) => total + duration, 0) /
      durations.length,
  );
}

function getCollectionValue(items: UserItemForList[]) {
  return sumMoney(
    items.flatMap((userItem) =>
      userItem.item.purchases.map((purchase) => ({
        amount: Number(purchase.totalPrice),
        currency: purchase.currency,
      })),
    ),
  );
}

function sumMoney(values: { amount: number; currency: string }[]) {
  const byCurrency = values.reduce<Record<string, number>>(
    (accumulator, value) => {
      accumulator[value.currency] =
        (accumulator[value.currency] ?? 0) + value.amount;
      return accumulator;
    },
    {},
  );

  return Object.entries(byCurrency)
    .map<MoneyAmountDto>(([currency, amount]) => ({
      amount,
      currency,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

function countByMonth(plays: { playedAt: Date }[]) {
  const counts = new Map<string, number>();

  plays.forEach(({ playedAt }) => {
    const month = `${playedAt.getFullYear()}-${String(
      playedAt.getMonth() + 1,
    ).padStart(2, "0")}`;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  });

  return Array.from(counts, ([month, playsCount]) => ({ month, playsCount }));
}

function countByPlayers(plays: { playersCount: number | null }[]) {
  const counts = new Map<number, number>();

  plays.forEach(({ playersCount }) => {
    if (playersCount !== null) {
      counts.set(playersCount, (counts.get(playersCount) ?? 0) + 1);
    }
  });

  return Array.from(counts, ([playersCount, playsCount]) => ({
    playersCount,
    playsCount,
  })).sort((left, right) => left.playersCount - right.playersCount);
}

function countByResult(plays: { result: string | null }[]) {
  const counts = new Map<PlayResult, number>();

  plays.forEach(({ result }) => {
    const normalized = isPlayResult(result) ? result : "unknown";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts, ([result, playsCount]) => ({ result, playsCount }));
}

function countByWeekday(plays: { playedAt: Date }[]) {
  const counts = new Map<number, number>();

  plays.forEach(({ playedAt }) => {
    const weekday = playedAt.getDay();
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  });

  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    playsCount: counts.get(weekday) ?? 0,
  }));
}

async function getExpansionUsage(
  plays: { usedItemIds: Prisma.JsonValue | null }[],
) {
  const counts = new Map<string, number>();

  plays.forEach(({ usedItemIds }) => {
    jsonStringArray(usedItemIds).forEach((itemId) => {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    });
  });

  const itemIds = [...counts.keys()];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, deletedAt: null },
    select: { id: true, title: true },
  });

  return items
    .map(({ id: itemId, title }) => ({
      itemId,
      title,
      playsCount: counts.get(itemId) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.playsCount - left.playsCount ||
        left.title.localeCompare(right.title, "ru"),
    );
}

function getFrequentPlayers(plays: { playerNames: Prisma.JsonValue | null }[]) {
  const players = new Map<string, { name: string; playsCount: number }>();

  plays.forEach(({ playerNames }) => {
    jsonStringArray(playerNames).forEach((name) => {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();

      if (key) {
        const player = players.get(key) ?? { name: trimmed, playsCount: 0 };
        player.playsCount += 1;
        players.set(key, player);
      }
    });
  });

  return [...players.values()]
    .sort(
      (left, right) =>
        right.playsCount - left.playsCount ||
        left.name.localeCompare(right.name, "ru"),
    )
    .slice(0, 10);
}

function isPlayResult(value: string | null): value is PlayResult {
  return value === "win" || value === "loss" || value === "score";
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
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
