import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { getIntegrationFeatureFlags } from "@/server/config/feature-flags";
import { ApiError } from "@/server/api/errors";
import type {
  ExpansionExternalSource,
  ExpansionOptionsResponse,
  ExpansionOptionDto,
} from "@/shared/api";

export async function getExternalExpansionOptions(
  source: ExpansionExternalSource,
  kind: "expansion" | "accessory" = "expansion",
): Promise<ExpansionOptionsResponse> {
  if (!getIntegrationFeatureFlags().externalProvidersEnabled)
    return {
      data: [],
      warnings: [
        {
          message:
            "Загрузка из внешних каталогов отключена в настройках сервера.",
        },
      ],
    };
  if (source.provider !== "boardgamegeek")
    return {
      data: [],
      warnings: [
        {
          message:
            "Загрузка состава игры доступна по ID BoardGameGeek. Добавьте ссылку BGG в справочные данные игры.",
        },
      ],
    };
  const results = await boardGameGeekProvider.getRelatedItems(
    source.externalId,
    kind,
  );
  const references = await prisma.externalReference.findMany({
    where: {
      provider: source.provider,
      externalId: { in: results.map((item) => item.externalId) },
    },
    include: { item: true },
  });
  const byId = new Map(references.map((ref) => [ref.externalId, ref.item]));
  return {
    data: results
      .filter((result) => !byId.get(result.externalId)?.deletedAt)
      .map((result) => {
        const item = byId.get(result.externalId);
        return {
          id: item?.id ?? `${result.provider}:${result.externalId}`,
          itemId: item?.id,
          title: item?.title ?? result.title,
          russianTitle:
            result.russianTitle ??
            (item && /[А-Яа-яЁё]/.test(item.title) ? item.title : null),
          year:
            result.year && result.year > 0
              ? result.year
              : item?.year && item.year > 0
                ? item.year
                : null,
          external: {
            provider: result.provider,
            externalId: result.externalId,
          },
        };
      }),
  };
}
export async function getGameExpansionOptions(
  itemId: string,
  kind: "expansion" | "accessory" = "expansion",
): Promise<ExpansionOptionsResponse> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, deletedAt: null },
    include: {
      externalReferences: true,
      parentRelations: {
        where: {
          relationType: kind === "accessory" ? "compatible_with" : "expands",
          childItem: { deletedAt: null, type: { code: kind } },
        },
        include: { childItem: true },
      },
    },
  });
  if (!item) throw ApiError.notFound("ITEM_NOT_FOUND", "Игра не найдена");
  const local: ExpansionOptionDto[] = item.parentRelations.map((relation) => ({
    id: relation.childItem.id,
    itemId: relation.childItem.id,
    title: relation.childItem.title,
    russianTitle: /[А-Яа-яЁё]/.test(relation.childItem.title)
      ? relation.childItem.title
      : null,
    year:
      relation.childItem.year && relation.childItem.year > 0
        ? relation.childItem.year
        : null,
  }));
  const source = item.externalReferences.find(
    (ref) => ref.provider === "boardgamegeek",
  );
  if (!source)
    return {
      data: local,
      warnings: [
        {
          message:
            "Для загрузки состава игры из каталога добавьте ссылку или ID BoardGameGeek в справочные данные игры.",
        },
      ],
    };
  try {
    const remote = await getExternalExpansionOptions(
      {
        provider: "boardgamegeek",
        externalId: source.externalId,
      },
      kind,
    );
    const merged = new Map(local.map((option) => [option.id, option]));
    for (const option of remote.data) merged.set(option.id, option);
    return {
      data: [...merged.values()].sort((a, b) => a.title.localeCompare(b.title)),
      warnings: remote.warnings,
    };
  } catch {
    return {
      data: local,
      warnings: [
        {
          message:
            "Не удалось загрузить состав игры из BoardGameGeek. Доступны сохранённые связи. Повторите загрузку.",
        },
      ],
    };
  }
}
