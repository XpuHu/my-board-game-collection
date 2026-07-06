import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/infrastructure/database/prisma";
import {
  addToCollectionRequestSchema,
  itemStatusSchema,
  providerCodeSchema,
  type AddToCollectionInput,
  type UpdateUserItemInput,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";

import {
  mapItemDetails,
  mapUserItem,
  type ItemForDetails,
  type UserItemWithTags,
} from "./item-mappers";

const createItemSchema = z
  .object({
    typeId: z.string().uuid(),
    title: z.string().trim().min(1),
    originalTitle: z.string().trim().min(1).nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    year: z.number().int().min(0).nullable().optional(),
    minPlayers: z.number().int().positive().nullable().optional(),
    maxPlayers: z.number().int().positive().nullable().optional(),
    minPlayTime: z.number().int().positive().nullable().optional(),
    maxPlayTime: z.number().int().positive().nullable().optional(),
    minAge: z.number().int().positive().nullable().optional(),
    complexity: z.number().nonnegative().nullable().optional(),
    rating: z.number().nonnegative().nullable().optional(),
    sourceMode: z.enum(["imported", "manual"]).default("manual"),
    categories: z.array(z.string().trim().min(1)).default([]),
    mechanics: z.array(z.string().trim().min(1)).default([]),
    designers: z.array(z.string().trim().min(1)).default([]),
    artists: z.array(z.string().trim().min(1)).default([]),
    publishers: z.array(z.string().trim().min(1)).default([]),
    externalReference: z
      .object({
        provider: providerCodeSchema,
        externalId: z.string().trim().min(1),
        url: z.string().url().nullable().optional(),
      })
      .optional(),
  })
  .strict();

export type CreateItemInput = z.infer<typeof createItemSchema>;

export { createItemSchema };

export async function createItem(input: CreateItemInput) {
  const existingExternalReference = input.externalReference
    ? await findByExternalReference(
        input.externalReference.provider,
        input.externalReference.externalId,
      )
    : null;

  if (existingExternalReference) {
    return existingExternalReference;
  }

  const item = await prisma.item.create({
    data: {
      typeId: input.typeId,
      title: input.title,
      originalTitle: input.originalTitle,
      description: input.description,
      year: input.year,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      minPlayTime: input.minPlayTime,
      maxPlayTime: input.maxPlayTime,
      minAge: input.minAge,
      complexity: input.complexity,
      rating: input.rating,
      sourceMode: input.sourceMode,
      categories: input.categories,
      mechanics: input.mechanics,
      designers: input.designers,
      artists: input.artists,
      publishers: input.publishers,
      externalReferences: input.externalReference
        ? {
            create: {
              provider: input.externalReference.provider,
              externalId: input.externalReference.externalId,
              url: input.externalReference.url,
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
  });

  return getItemDetails(item.id);
}

export async function findByExternalReference(
  provider: string,
  externalId: string,
) {
  const externalReference = await prisma.externalReference.findUnique({
    where: {
      provider_externalId: {
        provider,
        externalId,
      },
    },
  });

  return externalReference ? getItemDetails(externalReference.itemId) : null;
}

export async function getItemDetails(itemId: string) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
    },
    include: itemDetailsInclude,
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  }

  if (!item.userItem) {
    await prisma.userItem.create({
      data: {
        itemId,
        owned: false,
        wishlist: false,
        status: "wishlist",
      },
    });

    return getItemDetails(itemId);
  }

  return mapItemDetails(item);
}

export async function updateUserItem(
  itemId: string,
  input: UpdateUserItemInput,
) {
  await assertItemExists(itemId);

  const status = input.status ?? inferStatus(input.owned, input.wishlist);

  const userItem = await prisma.userItem.upsert({
    where: {
      itemId,
    },
    create: {
      itemId,
      status,
      owned: input.owned ?? false,
      wishlist: input.wishlist ?? false,
      location: input.location,
      personalRating: input.personalRating,
      notes: input.notes,
      interestLevel: input.interestLevel,
      decisionNotes: input.decisionNotes,
    },
    update: {
      status: input.status,
      owned: input.owned,
      wishlist: input.wishlist,
      location: input.location,
      personalRating: input.personalRating,
      notes: input.notes,
      interestLevel: input.interestLevel,
      decisionNotes: input.decisionNotes,
    },
  });

  if (input.tagIds) {
    await prisma.item.update({
      where: {
        id: itemId,
      },
      data: {
        tags: {
          set: input.tagIds.map((id) => ({ id })),
        },
      },
    });
  }

  return getUserItemDto(userItem.id);
}

export async function addItemToCollection(
  itemId: string,
  input: AddToCollectionInput,
) {
  addToCollectionRequestSchema.parse(input);
  await assertItemExists(itemId);

  await prisma.$transaction(async (tx) => {
    await tx.userItem.upsert({
      where: {
        itemId,
      },
      create: {
        itemId,
        owned: true,
        wishlist: false,
        status: "owned",
        location: input.location,
        personalRating: input.personalRating,
        notes: input.notes,
      },
      update: {
        owned: true,
        status: "owned",
        location: input.location,
        personalRating: input.personalRating,
        notes: input.notes,
      },
    });

    if (input.purchase) {
      const deliveryCost = input.purchase.deliveryCost ?? 0;
      const discount = input.purchase.discount ?? 0;
      const totalPrice =
        input.purchase.totalPrice ??
        input.purchase.price + deliveryCost - discount;

      await tx.purchase.create({
        data: {
          itemId,
          shop: input.purchase.shop,
          price: input.purchase.price,
          currency: input.purchase.currency,
          deliveryCost: input.purchase.deliveryCost,
          discount: input.purchase.discount,
          totalPrice,
          purchaseDate: input.purchase.purchaseDate
            ? new Date(input.purchase.purchaseDate)
            : undefined,
          comment: input.purchase.comment,
        },
      });
    }
  });

  return getItemDetails(itemId);
}

export async function addItemToWishlist(itemId: string) {
  await assertItemExists(itemId);

  const existing = await prisma.userItem.findUnique({
    where: {
      itemId,
    },
  });

  const userItem = await prisma.userItem.upsert({
    where: {
      itemId,
    },
    create: {
      itemId,
      owned: false,
      wishlist: true,
      status: "wishlist",
    },
    update: {
      wishlist: true,
      status: existing?.owned ? undefined : "wishlist",
    },
  });

  return getUserItemDto(userItem.id);
}

async function assertItemExists(itemId: string) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
  }
}

async function getUserItemDto(userItemId: string) {
  const userItem = await prisma.userItem.findUnique({
    where: {
      id: userItemId,
    },
    include: {
      item: {
        select: {
          tags: true,
        },
      },
    },
  });

  if (!userItem) {
    throw ApiError.notFound("ITEM_NOT_FOUND", "User item was not found");
  }

  return mapUserItem(userItem as UserItemWithTags);
}

function inferStatus(owned?: boolean, wishlist?: boolean) {
  if (owned) {
    return itemStatusSchema.parse("owned");
  }

  if (wishlist) {
    return itemStatusSchema.parse("wishlist");
  }

  return itemStatusSchema.parse("wishlist");
}

export const itemDetailsInclude = {
  type: true,
  userItem: true,
  externalReferences: {
    orderBy: {
      provider: "asc",
    },
  },
  images: {
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },
  links: {
    orderBy: {
      createdAt: "asc",
    },
  },
  purchases: {
    orderBy: {
      purchaseDate: "desc",
    },
  },
  preorders: {
    include: {
      events: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  playSessions: {
    orderBy: {
      playedAt: "desc",
    },
  },
  notes: {
    orderBy: {
      createdAt: "desc",
    },
  },
  tags: {
    orderBy: {
      name: "asc",
    },
  },
  parentRelations: {
    orderBy: {
      createdAt: "desc",
    },
  },
  childRelations: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.ItemInclude;

export function asItemForDetails(item: unknown) {
  return item as ItemForDetails;
}
