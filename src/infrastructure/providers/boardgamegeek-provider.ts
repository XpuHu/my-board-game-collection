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
import { getBggRequestHeaders } from "./bgg-request";

const BGG_BASE_URL = "https://boardgamegeek.com";
const BGG_XML_API_URL = `${BGG_BASE_URL}/xmlapi2`;
const PROVIDER_CODE = "boardgamegeek" satisfies ProviderCode;

const bggTypesByItemType: Partial<Record<ItemTypeCode, string[]>> = {
  base_game: ["boardgame"],
  expansion: ["boardgameexpansion"],
  accessory: ["boardgameaccessory"],
  organizer: ["boardgameaccessory"],
  component: ["boardgameaccessory"],
  miniature: ["boardgameaccessory"],
  playmat: ["boardgameaccessory"],
  sleeves: ["boardgameaccessory"],
  dice: ["boardgameaccessory"],
};

export class BoardGameGeekProvider implements ItemProvider {
  readonly code = PROVIDER_CODE;

  async searchItems(query: string, filters: ItemProviderFilters = {}) {
    const externalId = extractBggId(query);

    if (externalId) {
      const item = await this.getItem(externalId);
      return [providerItemToSearchResult(item)];
    }

    const searchParams = new URLSearchParams({
      query,
      type: bggTypesForFilter(filters.type).join(","),
    });
    const xml = await fetchBggXml(`/search?${searchParams.toString()}`);

    return parseSearchResults(xml).slice(0, 25);
  }

  async getItem(externalId: string) {
    const searchParams = new URLSearchParams({
      id: externalId,
      stats: "1",
    });
    const xml = await fetchBggXml(`/thing?${searchParams.toString()}`);
    const item = parseThing(xml, externalId);

    if (!item) {
      throw ApiError.notFound(
        "ITEM_NOT_FOUND",
        "BoardGameGeek item was not found",
      );
    }

    return item;
  }

  async getRelatedItems(
    externalId: string,
    kind: "expansion" | "accessory" = "expansion",
  ): Promise<ExternalSearchResultDto[]> {
    if (!/^\d+$/.test(externalId))
      throw ApiError.badRequest("VALIDATION_ERROR", "Invalid BoardGameGeek ID");
    const xml = await fetchBggXml(
      `/thing?id=${encodeURIComponent(externalId)}`,
    );
    const block = getElementBlocks(xml, "item").find(
      (item) => item.attrs.id === externalId,
    );
    if (!block)
      throw ApiError.notFound(
        "ITEM_NOT_FOUND",
        "BoardGameGeek item was not found",
      );
    const seen = new Set<string>();
    const expansions: ExternalSearchResultDto[] = getSelfClosingElements(
      block.body,
      "link",
    )
      .filter(
        (link) =>
          link.type ===
            (kind === "accessory"
              ? "boardgameaccessory"
              : "boardgameexpansion") &&
          link.inbound !== "true" &&
          Boolean(link.id) &&
          link.id !== externalId,
      )
      .filter((link) => {
        if (seen.has(link.id!)) return false;
        seen.add(link.id!);
        return true;
      })
      .map((link) => ({
        provider: PROVIDER_CODE,
        externalId: link.id!,
        title: link.value || "Untitled",
        itemTypeCode: kind,
        url: bggItemUrl(
          link.id!,
          kind === "accessory" ? "boardgameaccessory" : "boardgameexpansion",
        ),
      }));
    // The base game's links contain only IDs and names. Load publication data
    // and alternate names in batches rather than requesting every expansion.
    for (let offset = 0; offset < expansions.length; offset += 20) {
      const batch = expansions.slice(offset, offset + 20);
      try {
        const details = await fetchBggXml(
          `/thing?id=${batch.map((item) => item.externalId).join(",")}`,
        );
        for (const expansion of batch) {
          const item = parseThing(details, expansion.externalId);
          if (item) {
            expansion.title = item.title;
            expansion.russianTitle = item.russianTitle;
            expansion.year = item.year;
          }
        }
      } catch {
        // Keep selectable expansions when optional publication metadata is unavailable.
      }
    }
    return expansions;
  }

  async synchronizeItem(externalId: string) {
    return this.getItem(externalId);
  }
}

export const boardGameGeekProvider = new BoardGameGeekProvider();

async function fetchBggXml(path: string) {
  const response = await fetch(`${BGG_XML_API_URL}${path}`, {
    headers: getBggRequestHeaders(),
  });

  if (!response.ok || response.status === 202) {
    throw new ApiError(502, "PROVIDER_ERROR", "BoardGameGeek request failed", {
      provider: PROVIDER_CODE,
      status: response.status,
    });
  }

  return response.text();
}

function parseSearchResults(xml: string): ExternalSearchResultDto[] {
  return getElementBlocks(xml, "item").map(({ attrs, body }) => {
    const itemTypeCode = bggTypeToItemTypeCode(attrs.type);

    return {
      provider: PROVIDER_CODE,
      externalId: attrs.id ?? "",
      title: getElementAttr(body, "name", "value") ?? "Untitled",
      itemTypeCode,
      year: toInt(getElementAttr(body, "yearpublished", "value")),
      url: attrs.id ? bggItemUrl(attrs.id, attrs.type) : null,
    };
  });
}

function parseThing(xml: string, externalId: string): ProviderItem | null {
  const itemBlock = getElementBlocks(xml, "item").find(
    ({ attrs }) => attrs.id === externalId,
  );

  if (!itemBlock) {
    return null;
  }

  const { attrs, body } = itemBlock;
  const primaryName =
    getElementAttr(body, "name", "value", (nameAttrs) => {
      return nameAttrs.type === "primary";
    }) ?? getElementAttr(body, "name", "value");
  const itemTypeCode = bggTypeToItemTypeCode(attrs.type);
  const linkValues = getSelfClosingElements(body, "link");

  return {
    provider: PROVIDER_CODE,
    externalId,
    title: primaryName ?? "Untitled",
    russianTitle: russianName(body),
    originalTitle: primaryName ?? null,
    itemTypeCode,
    description: getElementText(body, "description"),
    year: toInt(getElementAttr(body, "yearpublished", "value")),
    minPlayers: toInt(getElementAttr(body, "minplayers", "value")),
    maxPlayers: toInt(getElementAttr(body, "maxplayers", "value")),
    minPlayTime: toInt(getElementAttr(body, "minplaytime", "value")),
    maxPlayTime: toInt(getElementAttr(body, "maxplaytime", "value")),
    minAge: toInt(getElementAttr(body, "minage", "value")),
    complexity: toFloat(getElementAttr(body, "averageweight", "value")),
    rating: toFloat(getElementAttr(body, "average", "value")),
    categories: linkValuesByType(linkValues, "boardgamecategory"),
    mechanics: linkValuesByType(linkValues, "boardgamemechanic"),
    designers: linkValuesByType(linkValues, "boardgamedesigner"),
    artists: linkValuesByType(linkValues, "boardgameartist"),
    publishers: linkValuesByType(linkValues, "boardgamepublisher"),
    imageUrl: getElementText(body, "image"),
    url: bggItemUrl(externalId, attrs.type),
  };
}

function russianName(body: string): string | null {
  const names = getSelfClosingElements(body, "name");
  const explicit = names.find(
    (name) =>
      /^(ru|rus|russian)$/i.test(name.language ?? name.lang ?? "") &&
      name.value,
  );
  if (explicit) return explicit.value;
  // BGG alternate names usually omit language. Prefer a Russian Cyrillic name;
  // do not translate titles or label other Cyrillic alphabets as Russian.
  return (
    names.find(
      (name) =>
        /[А-Яа-яЁё]/.test(name.value ?? "") &&
        !/[\u0400-\u040F\u0450-\u045F\u0460-\u052F]/.test(
          (name.value ?? "").replace(/[Ёё]/g, ""),
        ),
    )?.value ?? null
  );
}

function providerItemToSearchResult(
  item: ProviderItem,
): ExternalSearchResultDto {
  return {
    provider: item.provider,
    externalId: item.externalId,
    title: item.title,
    russianTitle: item.russianTitle,
    originalTitle: item.originalTitle,
    itemTypeCode: item.itemTypeCode,
    year: item.year,
    minPlayers: item.minPlayers,
    maxPlayers: item.maxPlayers,
    minPlayTime: item.minPlayTime,
    maxPlayTime: item.maxPlayTime,
    rating: item.rating,
    imageUrl: item.imageUrl,
    url: item.url,
    description: item.description,
  };
}

function bggTypesForFilter(type?: string) {
  if (isItemTypeCode(type)) {
    return bggTypesByItemType[type] ?? defaultBggTypes();
  }

  return defaultBggTypes();
}

function defaultBggTypes() {
  return ["boardgame", "boardgameexpansion", "boardgameaccessory"];
}

function bggTypeToItemTypeCode(type?: string): ItemTypeCode | null {
  if (type === "boardgame") {
    return "base_game";
  }

  if (type === "boardgameexpansion") {
    return "expansion";
  }

  if (type === "boardgameaccessory") {
    return "accessory";
  }

  return null;
}

function isItemTypeCode(value?: string): value is ItemTypeCode {
  return Boolean(
    value &&
    [
      "base_game",
      "expansion",
      "promo",
      "accessory",
      "organizer",
      "component",
      "miniature",
      "playmat",
      "sleeves",
      "dice",
      "other",
    ].includes(value),
  );
}

function extractBggId(value: string) {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const urlMatch = trimmed.match(
    /boardgamegeek\.com\/(?:boardgame|boardgameexpansion|boardgameaccessory|thing)\/(\d+)/i,
  );

  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const objectIdMatch = trimmed.match(/[?&]objectid=(\d+)/i);
  return objectIdMatch?.[1] ?? null;
}

function bggItemUrl(externalId: string, bggType?: string) {
  const path =
    bggType === "boardgameexpansion"
      ? "boardgameexpansion"
      : bggType === "boardgameaccessory"
        ? "boardgameaccessory"
        : "boardgame";

  return `${BGG_BASE_URL}/${path}/${externalId}`;
}

function getElementBlocks(xml: string, tagName: string) {
  const regexp = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    "g",
  );
  return [...xml.matchAll(regexp)].map((match) => ({
    attrs: parseAttrs(match[1] ?? ""),
    body: match[2] ?? "",
  }));
}

function getSelfClosingElements(xml: string, tagName: string) {
  const regexp = new RegExp(`<${tagName}\\b([^>]*)\\/>`, "g");
  return [...xml.matchAll(regexp)].map((match) => parseAttrs(match[1] ?? ""));
}

function getElementAttr(
  xml: string,
  tagName: string,
  attrName: string,
  predicate?: (attrs: Record<string, string>) => boolean,
) {
  const regexp = new RegExp(
    `<${tagName}\\b([^>]*)\\/?>(?:<\\/${tagName}>)?`,
    "g",
  );

  for (const match of xml.matchAll(regexp)) {
    const attrs = parseAttrs(match[1] ?? "");

    if (!predicate || predicate(attrs)) {
      return attrs[attrName] ?? null;
    }
  }

  return null;
}

function getElementText(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`),
  );

  return match?.[1] ? decodeXml(match[1]).trim() || null : null;
}

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};

  for (const match of source.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    attrs[match[1] ?? ""] = decodeXml(match[2] ?? "");
  }

  return attrs;
}

function linkValuesByType(links: Record<string, string>[], type: string) {
  return unique(
    links
      .filter((link) => link.type === type)
      .map((link) => link.value)
      .filter((value): value is string => Boolean(value)),
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function toInt(value?: string | null) {
  if (!value) {
    return null;
  }

  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function toFloat(value?: string | null) {
  if (!value) {
    return null;
  }

  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}
