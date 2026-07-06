import type {
  AddToCollectionRequest,
  CollectionItemDetailsDto,
  CreatePlaySessionRequest,
  CreatePreorderRequest,
  CreateTagRequest,
  ExternalSearchResponse,
  ImportExternalItemRequest,
  ItemDetailsDto,
  ItemListDto,
  PaginatedResponse,
  PlaySessionDto,
  PreorderDto,
  ProviderCode,
  SettingsDto,
  StatisticsSummaryDto,
  SyncBggPlaysRequest,
  SyncBggPlaysResponse,
  SyncItemRequest,
  SyncItemResponse,
  TagDto,
  UpdateBggSettingsRequest,
  UpdatePreorderExpectedDateRequest,
  UpdateUserItemRequest,
  UserItemDto,
  WishlistItemDetailsDto,
} from "@/shared/api/types";
import type { SettingsInput } from "@/shared/api/schemas";

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];

export type CollectionQuery = {
  q?: string;
  type?: string;
  rating?: number;
  location?: string;
  playedFrom?: string;
  playedTo?: string;
  hasActivePreorder?: boolean;
  tag?: string;
  page?: number;
  pageSize?: number;
};

export type WishlistQuery = {
  q?: string;
  minRating?: number;
  players?: number;
  maxPlayTime?: number;
  mechanics?: string[];
  categories?: string[];
  hasPrice?: boolean;
  page?: number;
  pageSize?: number;
};

export type ExternalSearchQuery = {
  q: string;
  provider?: ProviderCode;
  type?: string;
};

export type PlaysQuery = {
  itemId?: string;
  from?: string;
  to?: string;
  source?: "manual" | "boardgamegeek";
  page?: number;
  pageSize?: number;
};

export type CreateItemRequest = {
  typeId: string;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  minAge?: number | null;
  complexity?: number | null;
  rating?: number | null;
  sourceMode?: "imported" | "manual";
  categories?: string[];
  mechanics?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
  externalReference?: {
    provider: ProviderCode;
    externalId: string;
    url?: string | null;
  };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string;
    status: number;
    code?: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createApiClient(options: { baseUrl?: string } = {}) {
  const baseUrl = options.baseUrl ?? "";

  async function request<T>(
    path: string,
    init: RequestInit & { query?: Record<string, QueryValue> } = {},
  ): Promise<T> {
    const { query, headers, body, ...requestInit } = init;
    const url = `${baseUrl}${withQuery(path, query)}`;
    const response = await fetch(url, {
      ...requestInit,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      throw await toApiClientError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    collection: {
      list: (query?: CollectionQuery) =>
        request<PaginatedResponse<ItemListDto>>("/api/collection", { query }),
      get: (itemId: string) =>
        request<CollectionItemDetailsDto>(
          `/api/collection/${encodeURIComponent(itemId)}`,
        ),
      add: (itemId: string, body: AddToCollectionRequest = {}) =>
        request<ItemDetailsDto>(
          `/api/items/${encodeURIComponent(itemId)}/collection`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        ),
    },
    wishlist: {
      list: (query?: WishlistQuery) =>
        request<PaginatedResponse<ItemListDto>>("/api/wishlist", { query }),
      get: (itemId: string) =>
        request<WishlistItemDetailsDto>(
          `/api/wishlist/${encodeURIComponent(itemId)}`,
        ),
      add: (itemId: string) =>
        request<UserItemDto>(
          `/api/items/${encodeURIComponent(itemId)}/wishlist`,
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        ),
    },
    items: {
      create: (body: CreateItemRequest) =>
        request<ItemDetailsDto>("/api/items", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateUserItem: (itemId: string, body: UpdateUserItemRequest) =>
        request<UserItemDto>(
          `/api/items/${encodeURIComponent(itemId)}/user-item`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      sync: (itemId: string, body: SyncItemRequest = {}) =>
        request<SyncItemResponse>(
          `/api/items/${encodeURIComponent(itemId)}/sync`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        ),
    },
    plays: {
      list: (query?: PlaysQuery) =>
        request<PaginatedResponse<PlaySessionDto>>("/api/plays", { query }),
      create: (itemId: string, body: CreatePlaySessionRequest) =>
        request<PlaySessionDto>(
          `/api/items/${encodeURIComponent(itemId)}/plays`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        ),
      update: (playId: string, body: Partial<CreatePlaySessionRequest>) =>
        request<PlaySessionDto>(`/api/plays/${encodeURIComponent(playId)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      delete: (playId: string) =>
        request<void>(`/api/plays/${encodeURIComponent(playId)}`, {
          method: "DELETE",
        }),
    },
    preorders: {
      list: () => request<PreorderDto[]>("/api/preorders"),
      create: (itemId: string, body: CreatePreorderRequest) =>
        request<PreorderDto>(
          `/api/items/${encodeURIComponent(itemId)}/preorders`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        ),
      update: (preorderId: string, body: Partial<CreatePreorderRequest>) =>
        request<PreorderDto>(
          `/api/preorders/${encodeURIComponent(preorderId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      updateExpectedDate: (
        preorderId: string,
        body: UpdatePreorderExpectedDateRequest,
      ) =>
        request<PreorderDto>(
          `/api/preorders/${encodeURIComponent(preorderId)}/expected-date`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      delete: (preorderId: string) =>
        request<void>(`/api/preorders/${encodeURIComponent(preorderId)}`, {
          method: "DELETE",
        }),
    },
    externalSearch: {
      search: (query: ExternalSearchQuery) =>
        request<ExternalSearchResponse>("/api/external/search", { query }),
      import: (body: ImportExternalItemRequest) =>
        request<ItemDetailsDto>("/api/external/import", {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
    bggSync: {
      updateSettings: (body: UpdateBggSettingsRequest) =>
        request<SettingsDto>("/api/settings/bgg", {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      syncPlays: (body: SyncBggPlaysRequest = {}) =>
        request<SyncBggPlaysResponse>("/api/sync/bgg/plays", {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
    statistics: {
      summary: () => request<StatisticsSummaryDto>("/api/statistics/summary"),
    },
    tags: {
      list: () => request<TagDto[]>("/api/tags"),
      create: (body: CreateTagRequest) =>
        request<TagDto>("/api/tags", {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
    settings: {
      get: () => request<SettingsDto>("/api/settings"),
      update: (body: SettingsInput) =>
        request<SettingsDto>("/api/settings", {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
    },
  };
}

export const apiClient = createApiClient();

function withQuery(path: string, query?: Record<string, QueryValue>) {
  if (!query) {
    return path;
  }

  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, String(entry)));
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function toApiClientError(response: Response) {
  const fallbackMessage = `API request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
    };

    return new ApiClientError({
      status: response.status,
      code: payload.error?.code,
      message: payload.error?.message ?? fallbackMessage,
      details: payload.error?.details,
    });
  } catch {
    return new ApiClientError({
      status: response.status,
      message: fallbackMessage,
    });
  }
}
