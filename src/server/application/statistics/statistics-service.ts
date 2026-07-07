import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  ItemListDto,
  MoneyAmountDto,
  StatisticsSummaryDto,
} from "@/shared/api";
import {
  mapItemList,
  mapPlaySession,
  type UserItemForList,
} from "@/server/application/items/item-mappers";

const activePreorderStatuses = ["planned", "ordered", "paid", "shipped"];

export async function getStatisticsSummary(): Promise<StatisticsSummaryDto> {
  const [plays, ownedItems, wishlistTotal, activePreorders] =
    await Promise.all([
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
    ]);

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
        amount: Number(preorder.price),
        currency: preorder.currency,
      })),
    ),
  };
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
