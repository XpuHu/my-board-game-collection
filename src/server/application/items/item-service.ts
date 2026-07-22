import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/infrastructure/database/prisma";
import {
  addToCollectionRequestSchema,
  providerCodeSchema,
  type AddToCollectionInput,
  type CreateExternalReferenceInput,
  type CreateImageInput,
  type CreateLinkInput,
  type UpdateExternalReferenceInput,
  type UpdateImageInput,
  type UpdateItemInput,
  type UpdateLinkInput,
  type UpdateUserItemInput,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";

import {
  mapItemDetails,
  mapUserItem,
  type ItemForDetails,
  type UserItemWithTags,
} from "./item-mappers";
import {
  collectionTransition,
  resolveUserItemTransition,
  wishlistTransition,
} from "./user-item-transition";

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
    imageUrl: z.string().url().nullable().optional(),
    linkUrl: z.string().url().nullable().optional(),
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
      images: input.imageUrl
        ? {
            create: {
              type: "user",
              provider: "manual",
              url: input.imageUrl,
              caption: "Manual URL",
              sortOrder: 0,
            },
          }
        : undefined,
      links: input.linkUrl
        ? {
            create: {
              type: "other",
              url: input.linkUrl,
              title: "Manual link",
            },
          }
        : undefined,
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
          status: "active",
        },
      },
    },
  });

  return getItemDetails(item.id);
}

export async function updateItem(itemId: string, input: UpdateItemInput) {
  await assertItemExists(itemId);

  await prisma.item.update({
    where: {
      id: itemId,
    },
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
      categories: input.categories,
      mechanics: input.mechanics,
      designers: input.designers,
      artists: input.artists,
      publishers: input.publishers,
    },
  });

  return getItemDetails(itemId);
}

export async function createExternalReference(
  itemId: string,
  input: CreateExternalReferenceInput,
) {
  await assertItemExists(itemId);

  await prisma.externalReference.create({
    data: {
      itemId,
      provider: input.provider,
      externalId: input.externalId,
      url: input.url,
    },
  });

  return getItemDetails(itemId);
}

export async function updateExternalReference(
  itemId: string,
  referenceId: string,
  input: UpdateExternalReferenceInput,
) {
  await assertOwnedItemChild(itemId, "externalReference", referenceId);

  await prisma.externalReference.update({
    where: {
      id: referenceId,
    },
    data: {
      provider: input.provider,
      externalId: input.externalId,
      url: input.url,
      lastSync: input.provider || input.externalId ? null : undefined,
    },
  });

  return getItemDetails(itemId);
}

export async function deleteExternalReference(
  itemId: string,
  referenceId: string,
) {
  await assertOwnedItemChild(itemId, "externalReference", referenceId);

  await prisma.externalReference.delete({
    where: {
      id: referenceId,
    },
  });

  return getItemDetails(itemId);
}

export async function createImage(itemId: string, input: CreateImageInput) {
  await assertItemExists(itemId);

  await prisma.image.create({
    data: {
      itemId,
      type: input.type,
      provider: input.provider,
      url: input.url,
      path: input.path,
      caption: input.caption,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  return getItemDetails(itemId);
}

export async function updateImage(
  itemId: string,
  imageId: string,
  input: UpdateImageInput,
) {
  await assertOwnedItemChild(itemId, "image", imageId);

  await prisma.image.update({
    where: {
      id: imageId,
    },
    data: {
      type: input.type,
      provider: input.provider,
      url: input.url,
      path: input.path,
      caption: input.caption,
      sortOrder: input.sortOrder,
    },
  });

  return getItemDetails(itemId);
}

export async function deleteImage(itemId: string, imageId: string) {
  await assertOwnedItemChild(itemId, "image", imageId);

  await prisma.image.delete({
    where: {
      id: imageId,
    },
  });

  return getItemDetails(itemId);
}

export async function createLink(itemId: string, input: CreateLinkInput) {
  await assertItemExists(itemId);

  await prisma.link.create({
    data: {
      itemId,
      type: input.type,
      url: input.url,
      title: input.title,
    },
  });

  return getItemDetails(itemId);
}

export async function updateLink(
  itemId: string,
  linkId: string,
  input: UpdateLinkInput,
) {
  await assertOwnedItemChild(itemId, "link", linkId);

  await prisma.link.update({
    where: {
      id: linkId,
    },
    data: {
      type: input.type,
      url: input.url,
      title: input.title,
    },
  });

  return getItemDetails(itemId);
}

export async function deleteLink(itemId: string, linkId: string) {
  await assertOwnedItemChild(itemId, "link", linkId);

  await prisma.link.delete({
    where: {
      id: linkId,
    },
  });

  return getItemDetails(itemId);
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
        status: "active",
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

  const userItemId = await prisma.$transaction(async (tx) => {
    const current = await tx.userItem.findUnique({ where: { itemId } });
    const next = resolveUserItemTransition(current, input);
    const userItem = await tx.userItem.upsert({
      where: { itemId },
      create: {
        itemId,
        ...next,
        favorite: input.favorite,
        location: input.location,
        personalRating: input.personalRating,
        notes: input.notes,
        interestLevel: input.interestLevel,
        decisionNotes: input.decisionNotes,
      },
      update: {
        ...next,
        favorite: input.favorite,
        location: input.location,
        personalRating: input.personalRating,
        notes: input.notes,
        interestLevel: input.interestLevel,
        decisionNotes: input.decisionNotes,
      },
    });

    if (input.tagIds) {
      await tx.item.update({
        where: { id: itemId },
        data: {
          tags: {
            set: input.tagIds.map((id) => ({ id })),
          },
        },
      });
    }

    return userItem.id;
  });

  return getUserItemDto(userItemId);
}

export async function addItemToCollection(
  itemId: string,
  input: AddToCollectionInput,
) {
  addToCollectionRequestSchema.parse(input);
  await assertItemExists(itemId);

  await prisma.$transaction(async (tx) => {
    const current = await tx.userItem.findUnique({ where: { itemId } });
    const next = resolveUserItemTransition(current, collectionTransition());
    await tx.userItem.upsert({
      where: {
        itemId,
      },
      create: {
        itemId,
        ...next,
        location: input.location,
        personalRating: input.personalRating,
        notes: input.notes,
      },
      update: {
        ...next,
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

  const userItemId = await prisma.$transaction(async (tx) => {
    const current = await tx.userItem.findUnique({ where: { itemId } });
    const next = resolveUserItemTransition(
      current,
      wishlistTransition(current),
    );
    const userItem = await tx.userItem.upsert({
      where: { itemId },
      create: { itemId, ...next },
      update: next,
    });
    return userItem.id;
  });

  return getUserItemDto(userItemId);
}

export async function removeItemFromWishlist(itemId: string) {
  await assertItemExists(itemId);

  const userItemId = await prisma.$transaction(async (tx) => {
    const current = await tx.userItem.findUnique({ where: { itemId } });

    if (!current?.wishlist) {
      throw ApiError.notFound(
        "WISHLIST_ITEM_NOT_FOUND",
        "Item is not in the wishlist",
      );
    }

    const next = resolveUserItemTransition(current, { wishlist: false });
    const userItem = await tx.userItem.update({
      where: { itemId },
      data: next,
    });

    return userItem.id;
  });

  return getUserItemDto(userItemId);
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

async function assertOwnedItemChild(
  itemId: string,
  kind: "externalReference" | "image" | "link",
  childId: string,
) {
  await assertItemExists(itemId);

  const where = {
    id: childId,
    itemId,
  };
  const select = {
    id: true,
  };
  const child =
    kind === "externalReference"
      ? await prisma.externalReference.findFirst({ where, select })
      : kind === "image"
        ? await prisma.image.findFirst({ where, select })
        : await prisma.link.findFirst({ where, select });

  if (!child) {
    throw ApiError.notFound("ITEM_CHILD_NOT_FOUND", "Item child was not found");
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
    include: {
      childItem: {
        include: {
          type: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  childRelations: {
    include: {
      parentItem: {
        include: {
          type: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.ItemInclude;

export function asItemForDetails(item: unknown) {
  return item as ItemForDetails;
}
