import type {
  CollectionCardDto,
  DashboardDto,
  PaginatedResponse,
} from "./types";

export function createCollectionFixture(
  count: number,
  page = 1,
  pageSize = 24,
): PaginatedResponse<CollectionCardDto> {
  const all = Array.from({ length: count }, (_, index) => collectionCard(index));
  const start = (page - 1) * pageSize;
  return {
    data: all.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export const collectionFixtures = {
  empty: createCollectionFixture(0),
  single: createCollectionFixture(1),
  regular: createCollectionFixture(6),
  large: createCollectionFixture(101),
};

export const dashboardFixture: DashboardDto = {
  recentPlays: [],
  upcomingPreorders: [],
  recentlyAdded: collectionFixtures.regular.data.slice(0, 4),
  monthSummary: {
    playsCount: 0,
    uniqueItemsCount: 0,
    totalDurationMinutes: 0,
    averagePersonalRating: null,
    winsCount: 0,
  },
  favoriteItem: null,
  activity: [],
};

function collectionCard(index: number): CollectionCardDto {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return {
    item: {
      id,
      title: `Fixture game ${index + 1}`,
      originalTitle: null,
      type: {
        id: "00000000-0000-4000-8000-000000000001",
        code: "base_game",
        name: "Игра",
      },
      year: 2020 + (index % 7),
      cover: null,
      minPlayers: 1,
      maxPlayers: 4,
      minPlayTime: 30,
      maxPlayTime: 90,
      communityRating: 7 + (index % 3) / 10,
    },
    userItem: {
      states: ["owned"],
      ownedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      favorite: false,
      personalRating: null,
      location: null,
      tags: [],
    },
    plays: { count: index % 5, lastPlayedAt: null, lastResult: null },
    expansionsCount: 0,
    imagesCount: 0,
    activePreorder: null,
    purchaseTotal: null,
  };
}
