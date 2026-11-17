import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
import { getBggRequestHeaders } from "@/infrastructure/providers/bgg-request";
import {
  getElementBlocks,
  getElementText,
  getElementAttr,
} from "@/infrastructure/providers/boardgamegeek-provider";
import { runCommand } from "@/server/application/items/command-receipt";
import {
  createItemInTransaction,
  createItemSchema,
  addToCollectionInTransaction,
} from "@/server/application/items/item-service";

export const bggCollectionEntrySchema = z
  .object({
    externalId: z.string().regex(/^\d{1,12}$/),
    title: z.string().trim().min(1).max(500),
    type: z.enum(["base_game", "expansion"]),
    imageUrl: z.string().url().nullable(),
    rating: z.number().min(0).max(10).nullable(),
  })
  .strict();
export type BggCollectionEntry = z.infer<typeof bggCollectionEntrySchema>;
export function parseBggCollection(xml: string): BggCollectionEntry[] {
  if (!/<items\b/.test(xml) || /<error\b/.test(xml))
    throw ApiError.badRequest(
      "BGG_COLLECTION_ERROR",
      "BGG не вернул коллекцию. Проверьте имя пользователя.",
    );
  const entries = new Map<string, BggCollectionEntry>();
  for (const { attrs, body } of getElementBlocks(xml, "item")) {
    if (getElementAttr(body, "status", "own") !== "1") continue;
    const rating = Number(getElementAttr(body, "rating", "value"));
    const entry = bggCollectionEntrySchema.parse({
      externalId: attrs.objectid,
      title: getElementText(body, "name"),
      type: attrs.subtype === "boardgameexpansion" ? "expansion" : "base_game",
      imageUrl: getElementText(body, "thumbnail"),
      rating:
        Number.isFinite(rating) && rating > 0 && rating <= 10 ? rating : null,
    });
    entries.set(entry.externalId, entry);
  }
  if (entries.size > 2000)
    throw ApiError.badRequest(
      "COLLECTION_TOO_LARGE",
      "За один импорт поддерживается до 2000 игр.",
    );
  return [...entries.values()];
}
export async function previewBggCollection(username: string) {
  const url = new URL("https://boardgamegeek.com/xmlapi2/collection");
  url.search = new URLSearchParams({
    username,
    own: "1",
    stats: "1",
  }).toString();
  const response = await fetch(url, {
    headers: getBggRequestHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 202)
    throw ApiError.badRequest(
      "BGG_PENDING",
      "BGG готовит коллекцию. Повторите запрос через несколько секунд.",
    );
  if (!response.ok)
    throw ApiError.badRequest(
      "BGG_UNAVAILABLE",
      response.status === 401 || response.status === 403
        ? "Для доступа к BGG настройте BGG_TOKEN на сервере."
        : "BGG временно недоступен. Повторите позже.",
    );
  const xml = await response.text();
  if (xml.length > 10000000)
    throw ApiError.badRequest(
      "COLLECTION_TOO_LARGE",
      "Ответ BGG слишком большой.",
    );
  return previewBggEntries(parseBggCollection(xml));
}
export async function previewBggEntries(rows: BggCollectionEntry[]) {
  const titles = rows.length
    ? await prisma.item.findMany({
        where: {
          deletedAt: null,
          OR: rows.map((row) => ({
            title: { equals: row.title, mode: "insensitive" as const },
          })),
        },
        select: { title: true },
      })
    : [];
  const existing = rows.length
    ? await prisma.externalReference.findMany({
        where: {
          provider: "boardgamegeek",
          externalId: { in: rows.map((r) => r.externalId) },
        },
        select: {
          externalId: true,
          item: {
            select: { deletedAt: true, userItem: { select: { owned: true } } },
          },
        },
      })
    : [];
  return rows.map((row) => {
    const match = existing.find((r) => r.externalId === row.externalId);
    return {
      ...row,
      match: match?.item.deletedAt
        ? "conflict"
        : match?.item.userItem?.owned
          ? "owned"
          : match
            ? "existing"
            : titles.some(
                  (item) =>
                    item.title.toLowerCase() === row.title.toLowerCase(),
                )
              ? "possible"
              : "new",
    };
  });
}
export async function applyBggCollectionEntry(
  operationId: string,
  entry: BggCollectionEntry,
) {
  return runCommand(operationId, "bgg-collection-import", entry, async (tx) => {
    const reference = await tx.externalReference.findUnique({
      where: {
        provider_externalId: {
          provider: "boardgamegeek",
          externalId: entry.externalId,
        },
      },
      include: { item: { include: { userItem: true } } },
    });
    if (reference?.item.deletedAt)
      throw ApiError.conflict(
        "DELETED_ITEM",
        "Найдена удалённая игра. Восстановите её отдельно либо пропустите.",
      );
    if (reference?.item.userItem?.owned)
      return { itemId: reference.itemId, result: "unchanged" };
    let itemId = reference?.itemId;
    if (!itemId) {
      const type = await tx.itemType.findUnique({
        where: { code: entry.type },
      });
      if (!type)
        throw ApiError.badRequest("ITEM_TYPE_MISSING", "Тип игры не настроен.");
      itemId = await createItemInTransaction(
        tx,
        createItemSchema.parse({
          title: entry.title,
          typeId: type.id,
          sourceMode: "imported",
          imageUrl: entry.imageUrl,
          externalReference: {
            provider: "boardgamegeek",
            externalId: entry.externalId,
            url: `https://boardgamegeek.com/boardgame/${entry.externalId}`,
          },
        }),
      );
    }
    await addToCollectionInTransaction(
      tx,
      itemId,
      reference
        ? {}
        : {
            personalRating:
              entry.rating === null
                ? null
                : Math.max(1, Math.round(entry.rating)),
          },
    );
    return { itemId, result: reference ? "added-existing" : "created" };
  });
}
