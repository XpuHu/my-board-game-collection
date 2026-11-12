import { preorderPositionSelectionSchema } from "@/shared/api";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import type { ProviderItem } from "@/infrastructure/providers/item-provider";
import { getIntegrationFeatureFlags } from "@/server/config/feature-flags";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/server/api/errors";
import { createItemInTransaction, createItemSchema } from "./item-service";
import { runCommand } from "./command-receipt";

export const expansionSelectionSchema = preorderPositionSelectionSchema;
export type ExpansionSelection = z.infer<typeof expansionSelectionSchema>;
export const attachExpansionsSchema = z
  .object({
    operationId: z.string().uuid(),
    expansions: z.array(expansionSelectionSchema).min(1).max(50),
  })
  .strict();

export async function prepareExpansionImports(
  selections: ExpansionSelection[],
  kind: "expansion" | "accessory" = "expansion",
) {
  const prepared = new Map<string, ProviderItem>();
  for (const { external } of selections) {
    if (!external || prepared.has(external.externalId)) continue;
    const existing = await prisma.externalReference.findUnique({
      where: { provider_externalId: external },
    });
    if (existing) continue;
    if (!getIntegrationFeatureFlags().externalProvidersEnabled)
      throw ApiError.serviceUnavailable(
        "PROVIDER_DISABLED",
        "Загрузка из внешних каталогов отключена",
      );
    const item = await boardGameGeekProvider.getItem(external.externalId);
    if (item.itemTypeCode !== kind)
      throw ApiError.badRequest(
        "INVALID_EXPANSION",
        "Тип выбранной записи не соответствует позиции лота",
      );
    prepared.set(external.externalId, item);
  }
  return prepared;
}

export async function linkExpansionsInTransaction(
  tx: Prisma.TransactionClient,
  baseItemId: string,
  selections: ExpansionSelection[],
  prepared = new Map<string, ProviderItem>(),
  kind: "expansion" | "accessory" = "expansion",
) {
  const base = await tx.item.findFirst({
    where: { id: baseItemId, deletedAt: null },
  });
  if (!base) throw ApiError.notFound("ITEM_NOT_FOUND", "Игра не найдена");
  const seen = new Set<string>();
  const items: { itemId: string; price?: number }[] = [];
  for (const selection of selections) {
    let itemId = selection.itemId;
    if (selection.external) {
      const external = selection.external;
      const existing = await tx.externalReference.findUnique({
        where: { provider_externalId: external },
      });
      if (existing) itemId = existing.itemId;
      else {
        const imported = prepared.get(external.externalId);
        if (!imported)
          throw ApiError.badRequest(
            "INVALID_EXPANSION",
            "Не удалось получить данные дополнения",
          );
        const type = await tx.itemType.findUniqueOrThrow({
          where: { code: kind },
        });
        itemId = await createItemInTransaction(
          tx,
          createItemSchema.parse({
            typeId: type.id,
            title: imported.title,
            originalTitle: imported.originalTitle,
            description: imported.description,
            year: imported.year,
            sourceMode: "imported",
            categories: imported.categories,
            mechanics: imported.mechanics,
            designers: imported.designers,
            artists: imported.artists,
            publishers: imported.publishers,
            imageUrl: imported.imageUrl,
            linkUrl: imported.url,
            externalReference: { ...external, url: imported.url },
          }),
        );
        await tx.image.updateMany({
          where: { itemId },
          data: { type: "reference", provider: external.provider },
        });
      }
    }
    if (!itemId) {
      const type = await tx.itemType.findUnique({
        where: { code: kind },
      });
      if (!type)
        throw ApiError.notFound(
          "ITEM_TYPE_NOT_FOUND",
          "Тип дополнения не найден",
        );
      itemId = await createItemInTransaction(
        tx,
        createItemSchema.parse({ typeId: type.id, title: selection.title }),
      );
    }
    const item = await tx.item.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { type: true },
    });
    if (!item)
      throw ApiError.notFound("ITEM_NOT_FOUND", "Дополнение не найдено");
    if (itemId === baseItemId || item.type.code !== kind || seen.has(itemId)) {
      throw ApiError.badRequest(
        "INVALID_EXPANSION",
        "Выберите разные дополнения, отличные от основной игры",
      );
    }
    seen.add(itemId);
    await tx.itemRelation.upsert({
      where: {
        parentItemId_childItemId_relationType: {
          parentItemId: baseItemId,
          childItemId: itemId,
          relationType: kind === "accessory" ? "compatible_with" : "expands",
        },
      },
      create: {
        parentItemId: baseItemId,
        childItemId: itemId,
        relationType: kind === "accessory" ? "compatible_with" : "expands",
      },
      update: {},
    });
    items.push({ itemId, price: selection.price });
  }
  return items;
}

export async function attachExpansions(
  itemId: string,
  input: z.infer<typeof attachExpansionsSchema>,
) {
  const { operationId, ...payload } = attachExpansionsSchema.parse(input);
  let prepared = new Map<string, ProviderItem>();
  return runCommand(
    operationId,
    "attach-expansions",
    { itemId, ...payload },
    async (tx) => {
      const expansions = await linkExpansionsInTransaction(
        tx,
        itemId,
        payload.expansions,
        prepared,
      );
      return { itemId, expansionIds: expansions.map((item) => item.itemId) };
    },
    payload.expansions.some((item) => item.external)
      ? async () => {
          prepared = await prepareExpansionImports(payload.expansions);
        }
      : undefined,
  );
}
