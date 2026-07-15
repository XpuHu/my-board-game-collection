import { z } from "zod";

import { itemTypeCodes, playResults } from "@/shared/api";
import { legacyResponseViewSchema } from "@/shared/api/legacy/schemas";

const integer = z.coerce.number().int();
const positiveInteger = integer.positive();
const nonNegativeInteger = integer.nonnegative();
const booleanParam = z.enum(["true", "false"]).transform((value) => value === "true");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  },
  "Expected a valid YYYY-MM-DD date",
);
const direction = z.enum(["asc", "desc"]);
const viewSchema = z
  .union([z.enum(["target", "compact"]), legacyResponseViewSchema])
  .default("target");

const collectionSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    type: z.enum(itemTypeCodes).optional(),
    personalRating: integer.min(1).max(10).optional(),
    playsMin: nonNegativeInteger.optional(),
    playsMax: nonNegativeInteger.optional(),
    lastPlayedFrom: calendarDate.optional(),
    lastPlayedTo: calendarDate.optional(),
    hasExpansions: booleanParam.optional(),
    hasActivePreorder: booleanParam.optional(),
    neverPlayed: booleanParam.optional(),
    notPlayedSince: calendarDate.optional(),
    location: z.string().trim().min(1).optional(),
    tag: z.array(z.string().trim().min(1)).optional(),
    favorite: booleanParam.optional(),
    sort: z
      .enum(["added", "lastPlayed", "plays", "rating", "title"])
      .default("added"),
    direction: direction.default("desc"),
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(24),
    view: viewSchema,
  })
  .superRefine((value, context) => {
    if (value.view !== "legacy" && value.pageSize !== 24) {
      context.addIssue({ code: "custom", path: ["pageSize"], message: "Collection pageSize must be 24" });
    }
    range(value.playsMin, value.playsMax, "playsMax", context);
    dateRange(value.lastPlayedFrom, value.lastPlayedTo, "lastPlayedTo", context);
    if (
      value.neverPlayed &&
      (value.lastPlayedFrom || value.lastPlayedTo || value.notPlayedSince)
    ) {
      context.addIssue({
        code: "custom",
        path: ["neverPlayed"],
        message: "neverPlayed conflicts with last-play filters",
      });
    }
  });

const wishlistSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    type: z.enum(itemTypeCodes).optional(),
    ratingMin: z.coerce.number().min(0).max(10).optional(),
    players: positiveInteger.optional(),
    playTimeMax: positiveInteger.optional(),
    complexityMin: z.coerce.number().min(0).max(5).optional(),
    complexityMax: z.coerce.number().min(0).max(5).optional(),
    mechanic: z.array(z.string().trim().min(1)).optional(),
    category: z.array(z.string().trim().min(1)).optional(),
    hasLocalization: booleanParam.optional(),
    hasPrice: booleanParam.optional(),
    interestLevel: integer.min(1).max(5).optional(),
    sort: z
      .enum(["interest", "rating", "year", "title", "updated"])
      .default("interest"),
    direction: direction.default("desc"),
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(24),
    view: viewSchema,
  })
  .superRefine((value, context) => {
    if (value.view !== "legacy" && value.pageSize !== 24) {
      context.addIssue({ code: "custom", path: ["pageSize"], message: "Wishlist pageSize must be 24" });
    }
    range(
      value.complexityMin,
      value.complexityMax,
      "complexityMax",
      context,
    );
  });

const playsSchema = z
  .object({
    itemId: z.string().uuid().optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    result: z.enum(playResults).optional(),
    player: z.string().trim().min(1).optional(),
    playersMin: positiveInteger.optional(),
    playersMax: positiveInteger.optional(),
    durationMin: nonNegativeInteger.optional(),
    durationMax: nonNegativeInteger.optional(),
    usedItemId: z.string().uuid().optional(),
    source: z.enum(["manual", "boardgamegeek"]).optional(),
    sort: z.enum(["playedAt", "duration", "rating"]).default("playedAt"),
    direction: direction.default("desc"),
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(24),
    view: viewSchema,
  })
  .superRefine((value, context) => {
    range(value.playersMin, value.playersMax, "playersMax", context);
    range(value.durationMin, value.durationMax, "durationMax", context);
    dateRange(value.from, value.to, "to", context);
    if ((value.player || value.usedItemId) && !(value.from || value.to)) {
      context.addIssue({
        code: "custom",
        path: [value.player ? "player" : "usedItemId"],
        message: "JSON play filters require an explicit from/to period",
      });
    }
  });

const preorderSchema = z
  .object({
    group: z.enum(["all", "active", "received", "cancelled"]).default("all"),
    itemId: z.string().uuid().optional(),
    expectedFrom: calendarDate.optional(),
    expectedTo: calendarDate.optional(),
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(24),
    view: viewSchema,
  })
  .superRefine((value, context) => {
    dateRange(value.expectedFrom, value.expectedTo, "expectedTo", context);
  });

export function parseCollectionQuery(searchParams: URLSearchParams) {
  return collectionSchema.parse({
    ...singleValues(searchParams),
    personalRating:
      searchParams.get("personalRating") ?? searchParams.get("rating") ?? undefined,
    lastPlayedFrom:
      searchParams.get("lastPlayedFrom") ?? searchParams.get("playedFrom") ?? undefined,
    lastPlayedTo:
      searchParams.get("lastPlayedTo") ?? searchParams.get("playedTo") ?? undefined,
    tag: all(searchParams, "tag"),
  });
}

export function parseWishlistQuery(searchParams: URLSearchParams) {
  return wishlistSchema.parse({
    ...singleValues(searchParams),
    ratingMin:
      searchParams.get("ratingMin") ?? searchParams.get("minRating") ?? undefined,
    playTimeMax:
      searchParams.get("playTimeMax") ?? searchParams.get("maxPlayTime") ?? undefined,
    mechanic: all(searchParams, "mechanic", "mechanics"),
    category: all(searchParams, "category", "categories"),
  });
}

export function parsePlaysQuery(searchParams: URLSearchParams) {
  return playsSchema.parse({
    ...singleValues(searchParams),
    player:
      searchParams.get("player") ?? searchParams.get("playerName") ?? undefined,
  });
}

export function parsePreorderQuery(searchParams: URLSearchParams) {
  return preorderSchema.parse(singleValues(searchParams));
}

export function parseResponseView(searchParams: URLSearchParams) {
  return viewSchema.parse(searchParams.get("view") ?? undefined);
}

export function parseCollectionDetailQuery(searchParams: URLSearchParams) {
  return z
    .object({
      tab: z
        .enum([
          "overview",
          "expansions",
          "plays",
          "photos",
          "purchases",
          "notes",
          "relations",
        ])
        .default("overview"),
      view: viewSchema,
    })
    .parse(singleValues(searchParams));
}

export function parseWishlistDetailQuery(searchParams: URLSearchParams) {
  return z
    .object({
      tab: z.enum(["overview", "photos", "relations", "links"]).default("overview"),
      view: viewSchema,
    })
    .parse(singleValues(searchParams));
}

function singleValues(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

function all(searchParams: URLSearchParams, key: string, alias?: string) {
  const values = [...searchParams.getAll(key), ...(alias ? searchParams.getAll(alias) : [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

function range(
  min: number | undefined,
  max: number | undefined,
  path: string,
  context: z.RefinementCtx,
) {
  if (min !== undefined && max !== undefined && min > max) {
    context.addIssue({ code: "custom", path: [path], message: "Maximum must be greater than or equal to minimum" });
  }
}

function dateRange(
  from: string | undefined,
  to: string | undefined,
  path: string,
  context: z.RefinementCtx,
) {
  if (from && to && from > to) {
    context.addIssue({ code: "custom", path: [path], message: "End date must not be before start date" });
  }
}
