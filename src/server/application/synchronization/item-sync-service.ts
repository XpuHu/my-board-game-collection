import type { ProviderCode, SyncItemInput, SyncItemResponse } from "@/shared/api";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { teseraProvider } from "@/infrastructure/providers/tesera-provider";
import type {
  ItemProvider,
  ProviderItem,
} from "@/infrastructure/providers/item-provider";
import { ApiError } from "@/server/api/errors";
import { getItemDetails } from "@/server/application/items/item-service";

type ItemReferenceSnapshot = {
  title: string;
  originalTitle: string | null;
  description: string | null;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  minAge: number | null;
  complexity: unknown;
  rating: unknown;
  categories: unknown;
  mechanics: unknown;
  designers: unknown;
  artists: unknown;
  publishers: unknown;
  type: {
    code: string;
  };
};

const PROVIDER_LABELS: Record<ProviderCode, string> = {
  boardgamegeek: "BoardGameGeek",
  tesera: "Tesera",
  nastolio: "Nastolio",
  manual: "Manual",
};

export async function syncItemReference(
  itemId: string,
  input: SyncItemInput,
): Promise<SyncItemResponse> {
  const reference = await resolveExternalReference(itemId, input.provider);
  const provider = getProvider(reference.provider as ProviderCode);
  const before = await getItemSnapshot(itemId);
  const providerItem = await provider.synchronizeItem(reference.externalId);
  const syncedAt = new Date();
  const typeId = await resolveTypeId(providerItem.itemTypeCode);
  const updatedFields = buildUpdatedFields(before, providerItem, Boolean(typeId));

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: {
        id: itemId,
      },
      data: {
        typeId: typeId ?? undefined,
        title: providerItem.title,
        originalTitle: providerItem.originalTitle,
        description: providerItem.description,
        year: providerItem.year,
        minPlayers: providerItem.minPlayers,
        maxPlayers: providerItem.maxPlayers,
        minPlayTime: providerItem.minPlayTime,
        maxPlayTime: providerItem.maxPlayTime,
        minAge: providerItem.minAge,
        complexity: providerItem.complexity,
        rating: providerItem.rating,
        sourceMode: "imported",
        categories: providerItem.categories,
        mechanics: providerItem.mechanics,
        designers: providerItem.designers,
        artists: providerItem.artists,
        publishers: providerItem.publishers,
      },
    });

    await tx.externalReference.update({
      where: {
        id: reference.id,
      },
      data: {
        url: providerItem.url,
        lastSync: syncedAt,
      },
    });

    await tx.image.deleteMany({
      where: {
        itemId,
        type: "reference",
        provider: reference.provider,
      },
    });

    if (providerItem.imageUrl) {
      await tx.image.create({
        data: {
          itemId,
          type: "reference",
          provider: reference.provider,
          url: providerItem.imageUrl,
          caption: PROVIDER_LABELS[reference.provider as ProviderCode],
          sortOrder: 0,
        },
      });
    }

    await tx.link.deleteMany({
      where: {
        itemId,
        title: PROVIDER_LABELS[reference.provider as ProviderCode],
      },
    });

    if (providerItem.url) {
      await tx.link.create({
        data: {
          itemId,
          type: "other",
          url: providerItem.url,
          title: PROVIDER_LABELS[reference.provider as ProviderCode],
        },
      });
    }
  });

  return {
    item: await getItemDetails(itemId),
    syncedAt: syncedAt.toISOString(),
    updatedFields,
  };
}

async function resolveExternalReference(
  itemId: string,
  requestedProvider?: ProviderCode,
) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
    },
    include: {
      externalReferences: {
        orderBy: {
          provider: "asc",
        },
      },
    },
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  }

  const reference = requestedProvider
    ? item.externalReferences.find(
        (entry) => entry.provider === requestedProvider,
      )
    : item.externalReferences.find((entry) => entry.provider !== "manual");

  if (!reference) {
    throw ApiError.notFound(
      "ITEM_NOT_FOUND",
      requestedProvider
        ? `Item has no ${requestedProvider} external reference`
        : "Item has no external reference for synchronization",
    );
  }

  return reference;
}

async function getItemSnapshot(itemId: string): Promise<ItemReferenceSnapshot> {
  const item = await prisma.item.findUnique({
    where: {
      id: itemId,
    },
    select: {
      title: true,
      originalTitle: true,
      description: true,
      year: true,
      minPlayers: true,
      maxPlayers: true,
      minPlayTime: true,
      maxPlayTime: true,
      minAge: true,
      complexity: true,
      rating: true,
      categories: true,
      mechanics: true,
      designers: true,
      artists: true,
      publishers: true,
      type: {
        select: {
          code: true,
        },
      },
    },
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  }

  return item;
}

function getProvider(providerCode: ProviderCode): ItemProvider {
  if (providerCode === "boardgamegeek") {
    return boardGameGeekProvider;
  }

  if (providerCode === "tesera") {
    return teseraProvider;
  }

  throw ApiError.badRequest(
    "VALIDATION_ERROR",
    `Provider ${providerCode} is not supported for synchronization yet`,
  );
}

async function resolveTypeId(itemTypeCode?: string | null) {
  if (!itemTypeCode) {
    return null;
  }

  const itemType = await prisma.itemType.findUnique({
    where: {
      code: itemTypeCode,
    },
    select: {
      id: true,
    },
  });

  return itemType?.id ?? null;
}

function buildUpdatedFields(
  before: ItemReferenceSnapshot,
  providerItem: ProviderItem,
  willUpdateType: boolean,
) {
  const changes: string[] = [];

  addChange(changes, "type", before.type.code, providerItem.itemTypeCode, {
    enabled: willUpdateType,
  });
  addChange(changes, "title", before.title, providerItem.title);
  addChange(
    changes,
    "originalTitle",
    before.originalTitle,
    providerItem.originalTitle,
  );
  addChange(
    changes,
    "description",
    before.description,
    providerItem.description,
  );
  addChange(changes, "year", before.year, providerItem.year);
  addChange(changes, "minPlayers", before.minPlayers, providerItem.minPlayers);
  addChange(changes, "maxPlayers", before.maxPlayers, providerItem.maxPlayers);
  addChange(
    changes,
    "minPlayTime",
    before.minPlayTime,
    providerItem.minPlayTime,
  );
  addChange(
    changes,
    "maxPlayTime",
    before.maxPlayTime,
    providerItem.maxPlayTime,
  );
  addChange(changes, "minAge", before.minAge, providerItem.minAge);
  addChange(changes, "complexity", toNumber(before.complexity), providerItem.complexity);
  addChange(changes, "rating", toNumber(before.rating), providerItem.rating);
  addChange(changes, "categories", jsonStringArray(before.categories), providerItem.categories);
  addChange(changes, "mechanics", jsonStringArray(before.mechanics), providerItem.mechanics);
  addChange(changes, "designers", jsonStringArray(before.designers), providerItem.designers);
  addChange(changes, "artists", jsonStringArray(before.artists), providerItem.artists);
  addChange(changes, "publishers", jsonStringArray(before.publishers), providerItem.publishers);
  changes.push("externalReferences");
  changes.push("images");
  changes.push("links");

  return changes;
}

function addChange(
  changes: string[],
  field: string,
  before: unknown,
  after: unknown,
  options: { enabled?: boolean } = {},
) {
  if (options.enabled === false) {
    return;
  }

  if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
    changes.push(field);
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
