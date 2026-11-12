import type {
  ProviderCode,
  SyncItemChangeDto,
  SyncItemField,
  SyncItemInput,
  SyncItemResponse,
} from "@/shared/api";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import { teseraProvider } from "@/infrastructure/providers/tesera-provider";
import type {
  ItemProvider,
  ProviderItem,
} from "@/infrastructure/providers/item-provider";
import { ApiError } from "@/server/api/errors";
import { getItemDetails } from "@/server/application/items/item-service";
import { syncItemTaxonomy } from "@/server/application/items/taxonomy-service";

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
  const typeId = await resolveTypeId(providerItem.itemTypeCode);
  const changes = buildChanges(
    before,
    providerItem,
    Boolean(typeId),
    reference.url,
  );

  if (input.preview) {
    return {
      item: await getItemDetails(itemId),
      preview: true,
      updatedFields: changes.map(({ field }) => field),
      changes,
    };
  }

  const selectedFields = new Set<SyncItemField>(
    input.fields ?? changes.map(({ field }) => field),
  );
  const appliedChanges = changes.filter(({ field }) =>
    selectedFields.has(field),
  );
  const syncedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: {
        id: itemId,
      },
      data: {
        typeId: selectedFields.has("type") && typeId ? typeId : undefined,
        title: selectedFields.has("title") ? providerItem.title : undefined,
        originalTitle: selectedFields.has("originalTitle")
          ? providerItem.originalTitle
          : undefined,
        description: selectedFields.has("description")
          ? providerItem.description
          : undefined,
        year: selectedFields.has("year") ? providerItem.year : undefined,
        minPlayers: selectedFields.has("minPlayers")
          ? providerItem.minPlayers
          : undefined,
        maxPlayers: selectedFields.has("maxPlayers")
          ? providerItem.maxPlayers
          : undefined,
        minPlayTime: selectedFields.has("minPlayTime")
          ? providerItem.minPlayTime
          : undefined,
        maxPlayTime: selectedFields.has("maxPlayTime")
          ? providerItem.maxPlayTime
          : undefined,
        minAge: selectedFields.has("minAge") ? providerItem.minAge : undefined,
        complexity: selectedFields.has("complexity")
          ? providerItem.complexity
          : undefined,
        rating: selectedFields.has("rating") ? providerItem.rating : undefined,
        sourceMode: "imported",
        categories: selectedFields.has("categories")
          ? providerItem.categories
          : undefined,
        mechanics: selectedFields.has("mechanics")
          ? providerItem.mechanics
          : undefined,
        designers: selectedFields.has("designers")
          ? providerItem.designers
          : undefined,
        artists: selectedFields.has("artists")
          ? providerItem.artists
          : undefined,
        publishers: selectedFields.has("publishers")
          ? providerItem.publishers
          : undefined,
      },
    });
    await syncItemTaxonomy(tx, itemId, {
      categories: selectedFields.has("categories")
        ? providerItem.categories
        : undefined,
      mechanics: selectedFields.has("mechanics")
        ? providerItem.mechanics
        : undefined,
      designers: selectedFields.has("designers")
        ? providerItem.designers
        : undefined,
      artists: selectedFields.has("artists") ? providerItem.artists : undefined,
      publishers: selectedFields.has("publishers")
        ? providerItem.publishers
        : undefined,
    });

    await tx.externalReference.update({
      where: {
        id: reference.id,
      },
      data: {
        url: selectedFields.has("externalReferences")
          ? providerItem.url
          : undefined,
        lastSync: syncedAt,
      },
    });

    if (selectedFields.has("images")) {
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
    }

    if (selectedFields.has("links")) {
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
    }
  });

  return {
    item: await getItemDetails(itemId),
    preview: false,
    syncedAt: syncedAt.toISOString(),
    updatedFields: appliedChanges.map(({ field }) => field),
    changes: appliedChanges,
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

export function buildChanges(
  before: ItemReferenceSnapshot,
  providerItem: ProviderItem,
  willUpdateType: boolean,
  referenceUrl?: string | null,
): SyncItemChangeDto[] {
  const changes: SyncItemChangeDto[] = [];

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
  addChange(
    changes,
    "complexity",
    toNumber(before.complexity),
    providerItem.complexity,
  );
  addChange(changes, "rating", toNumber(before.rating), providerItem.rating);
  addChange(
    changes,
    "categories",
    jsonStringArray(before.categories),
    providerItem.categories,
  );
  addChange(
    changes,
    "mechanics",
    jsonStringArray(before.mechanics),
    providerItem.mechanics,
  );
  addChange(
    changes,
    "designers",
    jsonStringArray(before.designers),
    providerItem.designers,
  );
  addChange(
    changes,
    "artists",
    jsonStringArray(before.artists),
    providerItem.artists,
  );
  addChange(
    changes,
    "publishers",
    jsonStringArray(before.publishers),
    providerItem.publishers,
  );
  addChange(
    changes,
    "externalReferences",
    referenceUrl ?? null,
    providerItem.url ?? null,
  );
  addChange(changes, "images", null, providerItem.imageUrl ?? null);
  addChange(changes, "links", referenceUrl ?? null, providerItem.url ?? null);

  return changes;
}

function addChange(
  changes: SyncItemChangeDto[],
  field: SyncItemField,
  before: unknown,
  after: unknown,
  options: { enabled?: boolean } = {},
) {
  if (options.enabled === false) {
    return;
  }

  if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
    changes.push({
      field,
      currentValue: before ?? null,
      incomingValue: after ?? null,
      selectedByDefault: isEmptyReferenceValue(before),
    });
  }
}

function isEmptyReferenceValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
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
