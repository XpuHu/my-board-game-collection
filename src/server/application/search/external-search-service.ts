import type {
  ExternalSearchResponse,
  ImportExternalItemRequest,
  ItemDetailsDto,
  ProviderCode,
} from "@/shared/api";
import { prisma } from "@/infrastructure/database/prisma";
import { boardGameGeekProvider } from "@/infrastructure/providers/boardgamegeek-provider";
import type {
  ItemProvider,
  ProviderItem,
} from "@/infrastructure/providers/item-provider";
import { ApiError } from "@/server/api/errors";
import {
  addItemToCollection,
  addItemToWishlist,
  getItemDetails,
} from "@/server/application/items/item-service";

export type ExternalSearchQuery = {
  q?: string;
  provider?: ProviderCode;
  type?: string;
};

export async function searchExternalItems(
  query: ExternalSearchQuery,
): Promise<ExternalSearchResponse> {
  const searchQuery = query.q?.trim();

  if (!searchQuery) {
    throw ApiError.badRequest("VALIDATION_ERROR", "Search query is required");
  }

  const provider = getProvider(query.provider ?? "boardgamegeek");
  const data = await provider.searchItems(searchQuery, {
    type: query.type,
  });

  return { data };
}

export async function importExternalItem(
  input: ImportExternalItemRequest,
): Promise<ItemDetailsDto> {
  const provider = getProvider(input.provider);
  const item = await provider.getItem(input.externalId);
  const itemId = await importOrReuseItem(item, input.typeId);

  if (input.target === "collection") {
    return addItemToCollection(itemId, {});
  }

  if (input.target === "wishlist") {
    await addItemToWishlist(itemId);
  }

  return getItemDetails(itemId);
}

function getProvider(providerCode: ProviderCode): ItemProvider {
  if (providerCode === "boardgamegeek") {
    return boardGameGeekProvider;
  }

  throw ApiError.badRequest(
    "VALIDATION_ERROR",
    `Provider ${providerCode} is not supported yet`,
  );
}

async function importOrReuseItem(item: ProviderItem, requestedTypeId?: string) {
  const existingReference = await prisma.externalReference.findUnique({
    where: {
      provider_externalId: {
        provider: item.provider,
        externalId: item.externalId,
      },
    },
    select: {
      itemId: true,
    },
  });

  if (existingReference) {
    return existingReference.itemId;
  }

  const typeId = await resolveTypeId(requestedTypeId, item.itemTypeCode);
  const created = await prisma.item.create({
    data: {
      typeId,
      title: item.title,
      originalTitle: item.originalTitle,
      description: item.description,
      year: item.year,
      minPlayers: item.minPlayers,
      maxPlayers: item.maxPlayers,
      minPlayTime: item.minPlayTime,
      maxPlayTime: item.maxPlayTime,
      minAge: item.minAge,
      complexity: item.complexity,
      rating: item.rating,
      sourceMode: "imported",
      categories: item.categories,
      mechanics: item.mechanics,
      designers: item.designers,
      artists: item.artists,
      publishers: item.publishers,
      externalReferences: {
        create: {
          provider: item.provider,
          externalId: item.externalId,
          url: item.url,
          lastSync: new Date(),
        },
      },
      images: item.imageUrl
        ? {
            create: {
              type: "reference",
              provider: item.provider,
              url: item.imageUrl,
              caption: "BoardGameGeek",
              sortOrder: 0,
            },
          }
        : undefined,
      links: item.url
        ? {
            create: {
              type: "other",
              url: item.url,
              title: "BoardGameGeek",
            },
          }
        : undefined,
      userItem: {
        create: {
          owned: false,
          wishlist: false,
          status: "wishlist",
        },
      },
    },
    select: {
      id: true,
    },
  });

  return created.id;
}

async function resolveTypeId(requestedTypeId?: string, itemTypeCode?: string | null) {
  if (requestedTypeId) {
    const itemType = await prisma.itemType.findUnique({
      where: {
        id: requestedTypeId,
      },
      select: {
        id: true,
      },
    });

    if (!itemType) {
      throw ApiError.notFound("ITEM_NOT_FOUND", "Item type was not found");
    }

    return itemType.id;
  }

  const typeCode = itemTypeCode ?? "base_game";
  const itemType =
    (await prisma.itemType.findUnique({
      where: {
        code: typeCode,
      },
      select: {
        id: true,
      },
    })) ??
    (await prisma.itemType.findUnique({
      where: {
        code: "other",
      },
      select: {
        id: true,
      },
    }));

  if (!itemType) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Default item type was not found");
  }

  return itemType.id;
}
