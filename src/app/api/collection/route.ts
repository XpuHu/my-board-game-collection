import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { parsePagination } from "@/server/api/pagination";
import {
  getBooleanSearchParam,
  getNumberSearchParam,
  getSearchParam,
} from "@/server/api/request";
import {
  listCollection,
  listCollectionCards,
  type CollectionQuery,
} from "@/server/application/collection/collection-service";
import { itemTypeCodes, type ItemTypeCode } from "@/shared/api";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);

    const query: CollectionQuery = {
      q: getSearchParam(searchParams, "q"),
      type: parseItemType(getSearchParam(searchParams, "type")),
      personalRating:
        getNumberSearchParam(searchParams, "personalRating") ??
        getNumberSearchParam(searchParams, "rating"),
      playsMin: getNumberSearchParam(searchParams, "playsMin"),
      playsMax: getNumberSearchParam(searchParams, "playsMax"),
      location: getSearchParam(searchParams, "location"),
      lastPlayedFrom:
        getSearchParam(searchParams, "lastPlayedFrom") ??
        getSearchParam(searchParams, "playedFrom"),
      lastPlayedTo:
        getSearchParam(searchParams, "lastPlayedTo") ??
        getSearchParam(searchParams, "playedTo"),
      hasExpansions: getBooleanSearchParam(searchParams, "hasExpansions"),
      hasActivePreorder: getBooleanSearchParam(
        searchParams,
        "hasActivePreorder",
      ),
      neverPlayed: getBooleanSearchParam(searchParams, "neverPlayed"),
      notPlayedSince: getSearchParam(searchParams, "notPlayedSince"),
      tag: getSearchParam(searchParams, "tag"),
      favorite: getBooleanSearchParam(searchParams, "favorite"),
      sort: parseCollectionSort(getSearchParam(searchParams, "sort")),
      direction: parseDirection(getSearchParam(searchParams, "direction")),
    };
    const pagination = parsePagination(searchParams, { pageSize: 24 });
    const response =
      getSearchParam(searchParams, "view") === "compact"
        ? await listCollectionCards(query, pagination)
        : await listCollection(query, pagination);

    return NextResponse.json(response);
  });
}

function parseCollectionSort(value?: string): CollectionQuery["sort"] {
  return ["added", "lastPlayed", "plays", "rating", "title"].includes(
    value ?? "",
  )
    ? (value as "added" | "lastPlayed" | "plays" | "rating" | "title")
    : undefined;
}

function parseDirection(value?: string): CollectionQuery["direction"] {
  return value === "asc" || value === "desc" ? value : undefined;
}

function parseItemType(value?: string): ItemTypeCode | undefined {
  return itemTypeCodes.includes(value as ItemTypeCode)
    ? (value as ItemTypeCode)
    : undefined;
}
