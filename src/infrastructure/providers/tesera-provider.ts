import type {
  ExternalSearchResultDto,
  ItemTypeCode,
  ProviderCode,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";

import type {
  ItemProvider,
  ItemProviderFilters,
  ProviderItem,
} from "./item-provider";

const TESERA_API_URL = "https://api.tesera.ru";
const TESERA_WEB_URL = "https://tesera.ru";
const PROVIDER_CODE = "tesera" satisfies ProviderCode;

export class TeseraProvider implements ItemProvider {
  readonly code = PROVIDER_CODE;

  async searchItems(query: string, _filters: ItemProviderFilters = {}) {
    const externalId = extractTeseraId(query);

    if (externalId) {
      const item = await this.getItem(externalId);
      return [providerItemToSearchResult(item)];
    }

    const searchParams = new URLSearchParams({
      query,
    });
    const payload = await fetchTeseraJson(`/games?${searchParams.toString()}`);

    return normalizeCollection(payload)
      .map(teseraGameToSearchResult)
      .filter((item): item is ExternalSearchResultDto => Boolean(item))
      .slice(0, 25);
  }

  async getItem(externalId: string) {
    const payload = await fetchTeseraJson(
      `/games/${encodeURIComponent(externalId)}`,
    );
    const item = teseraGameToProviderItem(payload, externalId);

    if (!item) {
      throw ApiError.notFound("ITEM_NOT_FOUND", "Tesera item was not found");
    }

    return item;
  }

  async getRelatedItems(_externalId: string) {
    return [];
  }

  async synchronizeItem(externalId: string) {
    return this.getItem(externalId);
  }
}

export const teseraProvider = new TeseraProvider();

async function fetchTeseraJson(path: string) {
  let response: Response;

  try {
    response = await fetch(`${TESERA_API_URL}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "BoardGameCollection/1.0",
      },
    });
  } catch (error) {
    throw new ApiError(502, "PROVIDER_ERROR", "Tesera request failed", {
      provider: PROVIDER_CODE,
      reason: error instanceof Error ? error.message : "Network error",
    });
  }

  if (!response.ok) {
    throw new ApiError(502, "PROVIDER_ERROR", "Tesera request failed", {
      provider: PROVIDER_CODE,
      status: response.status,
    });
  }

  return response.json() as Promise<unknown>;
}

function teseraGameToSearchResult(
  value: unknown,
): ExternalSearchResultDto | null {
  const item = teseraGameToProviderItem(value);

  return item ? providerItemToSearchResult(item) : null;
}

function teseraGameToProviderItem(
  value: unknown,
  fallbackExternalId?: string,
): ProviderItem | null {
  const game = asRecord(value);

  if (!game) {
    return null;
  }

  const externalId =
    firstString(game, ["alias", "teseraId", "gameId", "id", "code"]) ??
    fallbackExternalId;
  const title =
    firstString(game, [
      "title",
      "name",
      "titleRu",
      "titleRussian",
      "russianTitle",
    ]) ??
    firstString(game, ["titleOrig", "titleOriginal", "titleEn", "originalTitle"]);

  if (!externalId || !title) {
    return null;
  }

  const originalTitle =
    firstString(game, [
      "titleOrig",
      "titleOriginal",
      "titleEn",
      "originalTitle",
      "nameOriginal",
    ]) ?? null;

  return {
    provider: PROVIDER_CODE,
    externalId,
    title,
    originalTitle,
    itemTypeCode: teseraItemTypeCode(game),
    description: cleanText(
      firstString(game, [
        "description",
        "descriptionShort",
        "descriptionHtml",
        "overview",
      ]),
    ),
    year: firstNumber(game, ["year", "yearPublished", "publishYear"]),
    minPlayers: firstNumber(game, ["playersMin", "minPlayers", "playerMin"]),
    maxPlayers: firstNumber(game, ["playersMax", "maxPlayers", "playerMax"]),
    minPlayTime: firstNumber(game, [
      "playtimeMin",
      "minPlayTime",
      "playingTimeMin",
    ]),
    maxPlayTime: firstNumber(game, [
      "playtimeMax",
      "maxPlayTime",
      "playingTimeMax",
      "playtime",
    ]),
    minAge: firstNumber(game, ["playersAgeMin", "age", "minAge"]),
    complexity: firstNumber(game, ["complexity", "weight", "difficulty"]),
    rating: firstNumber(game, [
      "rating",
      "ratingUser",
      "ratingTesera",
      "teseraRating",
    ]),
    categories: stringList(game, ["categories", "genres", "tags"]),
    mechanics: stringList(game, ["mechanics"]),
    designers: stringList(game, ["designers", "authors"]),
    artists: stringList(game, ["artists"]),
    publishers: stringList(game, ["publishers", "companies"]),
    imageUrl: firstImageUrl(game),
    url: teseraItemUrl(externalId, game),
  };
}

function providerItemToSearchResult(
  item: ProviderItem,
): ExternalSearchResultDto {
  return {
    provider: item.provider,
    externalId: item.externalId,
    title: item.title,
    originalTitle: item.originalTitle,
    itemTypeCode: item.itemTypeCode,
    year: item.year,
    imageUrl: item.imageUrl,
    url: item.url,
    description: item.description,
  };
}

function normalizeCollection(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of ["data", "items", "games", "results", "rows"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function teseraItemTypeCode(game: Record<string, unknown>): ItemTypeCode {
  const rawType = firstString(game, [
    "type",
    "gameType",
    "gameTypeTitle",
    "kind",
  ])?.toLowerCase();

  if (rawType?.includes("доп") || rawType?.includes("expansion")) {
    return "expansion";
  }

  return "base_game";
}

function extractTeseraId(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(
    /(?:tesera\.ru|api\.tesera\.ru)\/(?:game|games)\/([^/?#]+)/i,
  );

  if (urlMatch?.[1]) {
    return decodeURIComponent(urlMatch[1]);
  }

  return null;
}

function teseraItemUrl(externalId: string, game: Record<string, unknown>) {
  const url = firstString(game, ["url", "teseraUrl", "link"]);

  if (url?.startsWith("http://") || url?.startsWith("https://")) {
    return url;
  }

  return `${TESERA_WEB_URL}/game/${encodeURIComponent(externalId)}/`;
}

function firstImageUrl(game: Record<string, unknown>) {
  const direct = firstString(game, [
    "imageUrl",
    "photoUrl",
    "coverUrl",
    "logoUrl",
    "photo",
    "image",
    "cover",
  ]);

  if (direct) {
    return direct;
  }

  for (const key of ["image", "photo", "cover", "logo"]) {
    const nested = asRecord(game[key]);
    const nestedUrl = nested
      ? firstString(nested, ["url", "src", "fullUrl", "imageUrl"])
      : null;

    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return null;
}

function stringList(game: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = game[key];
    const list = normalizeStringList(value);

    if (list.length > 0) {
      return list;
    }
  }

  return [];
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(
      value
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }

          const record = asRecord(entry);
          return record
            ? firstString(record, ["title", "name", "alias", "value"])
            : null;
        })
        .filter((entry): entry is string => Boolean(entry)),
    );
  }

  if (typeof value === "string") {
    return unique(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }

  return [];
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    const nested = asRecord(value);

    if (nested) {
      const nestedValue: string | null = firstString(nested, [
        "title",
        "name",
        "value",
      ]);

      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const number = Number.parseFloat(value.replace(",", "."));

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return null;
}

function cleanText(value?: string | null) {
  return (
    value
      ?.replace(/<[^>]*>/g, " ")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
