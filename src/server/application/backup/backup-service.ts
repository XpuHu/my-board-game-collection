import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import type {
  BackupItemDto,
  BackupItemTypeDto,
  BackupPlaySessionDto,
  JsonBackupDto,
  JsonImportReportDto,
} from "@/shared/api";
import type { JsonBackupInput } from "@/shared/api/schemas";

const SCHEMA_VERSION = 1;

type BackupTransaction = Prisma.TransactionClient;

export async function exportJsonBackup(): Promise<JsonBackupDto> {
  const [
    itemTypes,
    items,
    userItems,
    externalReferences,
    images,
    links,
    purchases,
    preorders,
    playSessions,
    notes,
    relations,
    tags,
  ] = await Promise.all([
    prisma.itemType.findMany({ orderBy: { code: "asc" } }),
    prisma.item.findMany({
      include: {
        tags: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { title: "asc" },
    }),
    prisma.userItem.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.externalReference.findMany({ orderBy: { provider: "asc" } }),
    prisma.image.findMany({ orderBy: [{ itemId: "asc" }, { sortOrder: "asc" }] }),
    prisma.link.findMany({ orderBy: [{ itemId: "asc" }, { createdAt: "asc" }] }),
    prisma.purchase.findMany({
      orderBy: [{ itemId: "asc" }, { purchaseDate: "desc" }],
    }),
    prisma.preorder.findMany({
      include: {
        events: {
          orderBy: { createdAt: "asc" },
        },
        item: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [{ itemId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.playSession.findMany({
      orderBy: [{ itemId: "asc" }, { playedAt: "desc" }],
    }),
    prisma.note.findMany({ orderBy: [{ itemId: "asc" }, { createdAt: "asc" }] }),
    prisma.itemRelation.findMany({
      orderBy: [{ parentItemId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      itemTypes: itemTypes.map((itemType): BackupItemTypeDto => ({
        id: itemType.id,
        code: itemType.code as BackupItemTypeDto["code"],
        name: itemType.name,
        isSystem: itemType.isSystem,
        createdAt: itemType.createdAt.toISOString(),
        updatedAt: itemType.updatedAt.toISOString(),
      })),
      items: items.map(({ tags: _tags, ...item }): BackupItemDto => ({
        id: item.id,
        typeId: item.typeId,
        title: item.title,
        originalTitle: item.originalTitle,
        description: item.description,
        year: item.year,
        minPlayers: item.minPlayers,
        maxPlayers: item.maxPlayers,
        minPlayTime: item.minPlayTime,
        maxPlayTime: item.maxPlayTime,
        minAge: item.minAge,
        complexity: decimalToNumber(item.complexity),
        rating: decimalToNumber(item.rating),
        sourceMode: item.sourceMode as BackupItemDto["sourceMode"],
        categories: jsonStringArray(item.categories),
        mechanics: jsonStringArray(item.mechanics),
        designers: jsonStringArray(item.designers),
        artists: jsonStringArray(item.artists),
        publishers: jsonStringArray(item.publishers),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        deletedAt: item.deletedAt?.toISOString() ?? null,
      })),
      userItems: userItems.map((userItem) => ({
        id: userItem.id,
        itemId: userItem.itemId,
        status: userItem.status as JsonBackupDto["data"]["userItems"][number]["status"],
        owned: userItem.owned,
        wishlist: userItem.wishlist,
        location: userItem.location,
        personalRating: userItem.personalRating,
        notes: userItem.notes,
        interestLevel: userItem.interestLevel,
        decisionNotes: userItem.decisionNotes,
        createdAt: userItem.createdAt.toISOString(),
        updatedAt: userItem.updatedAt.toISOString(),
      })),
      externalReferences: externalReferences.map((reference) => ({
        id: reference.id,
        itemId: reference.itemId,
        provider: reference.provider as JsonBackupDto["data"]["externalReferences"][number]["provider"],
        externalId: reference.externalId,
        url: reference.url,
        lastSync: reference.lastSync?.toISOString() ?? null,
      })),
      images: images.map((image) => ({
        id: image.id,
        itemId: image.itemId,
        type: image.type as JsonBackupDto["data"]["images"][number]["type"],
        provider: image.provider as JsonBackupDto["data"]["images"][number]["provider"],
        url: image.url,
        path: image.path,
        caption: image.caption,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt.toISOString(),
      })),
      links: links.map((link) => ({
        id: link.id,
        itemId: link.itemId,
        type: link.type as JsonBackupDto["data"]["links"][number]["type"],
        url: link.url,
        title: link.title,
      })),
      purchases: purchases.map((purchase) => ({
        id: purchase.id,
        itemId: purchase.itemId,
        shop: purchase.shop,
        price: decimalToNumber(purchase.price) ?? 0,
        currency: purchase.currency,
        deliveryCost: decimalToNumber(purchase.deliveryCost),
        discount: decimalToNumber(purchase.discount),
        totalPrice: decimalToNumber(purchase.totalPrice) ?? 0,
        purchaseDate: purchase.purchaseDate?.toISOString() ?? null,
        comment: purchase.comment,
        createdAt: purchase.createdAt.toISOString(),
        updatedAt: purchase.updatedAt.toISOString(),
      })),
      preorders: preorders.map((preorder) => ({
        id: preorder.id,
        itemId: preorder.itemId,
        itemTitle: preorder.item.title,
        shop: preorder.shop,
        price: decimalToNumber(preorder.price) ?? 0,
        currency: preorder.currency,
        orderDate: preorder.orderDate?.toISOString() ?? null,
        expectedDate: preorder.expectedDate?.toISOString() ?? null,
        receivedDate: preorder.receivedDate?.toISOString() ?? null,
        trackingNumber: preorder.trackingNumber,
        status: preorder.status as JsonBackupDto["data"]["preorders"][number]["status"],
        comment: preorder.comment,
        events: preorder.events.map((event) => ({
          id: event.id,
          preorderId: event.preorderId,
          type: event.type,
          oldValue: event.oldValue,
          newValue: event.newValue,
          reason: event.reason,
          comment: event.comment,
          createdAt: event.createdAt.toISOString(),
        })),
        createdAt: preorder.createdAt.toISOString(),
        updatedAt: preorder.updatedAt.toISOString(),
      })),
      playSessions: playSessions.map(
        (playSession): BackupPlaySessionDto => ({
          id: playSession.id,
          itemId: playSession.itemId,
          playedAt: playSession.playedAt.toISOString(),
          playersCount: playSession.playersCount,
          durationMinutes: playSession.durationMinutes,
          result: playSession.result as BackupPlaySessionDto["result"],
          score: playSession.score,
          scenario: playSession.scenario,
          playerNames: jsonStringArray(playSession.playerNames),
          usedItemIds: jsonStringArray(playSession.usedItemIds),
          notes: playSession.notes,
          source: playSession.source as BackupPlaySessionDto["source"],
          bggPlayId: playSession.bggPlayId,
          locallyModifiedAt:
            playSession.locallyModifiedAt?.toISOString() ?? null,
          importedAt: playSession.importedAt?.toISOString() ?? null,
          createdAt: playSession.createdAt.toISOString(),
          updatedAt: playSession.updatedAt.toISOString(),
        }),
      ),
      notes: notes.map((note) => ({
        id: note.id,
        itemId: note.itemId,
        title: note.title,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
      relations: relations.map((relation) => ({
        id: relation.id,
        parentItemId: relation.parentItemId,
        childItemId: relation.childItemId,
        relationType: relation.relationType,
        comment: relation.comment,
        createdAt: relation.createdAt.toISOString(),
        updatedAt: relation.updatedAt.toISOString(),
      })),
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      })),
      itemTags: items.flatMap((item) =>
        item.tags.map((tag) => ({
          itemId: item.id,
          tagId: tag.id,
        })),
      ),
    },
  };
}

export async function importJsonBackup(
  backup: JsonBackupInput,
): Promise<JsonImportReportDto> {
  const importedAt = new Date();
  const report: JsonImportReportDto = {
    importedAt: importedAt.toISOString(),
    created: {},
    updated: {},
    skippedDuplicates: {
      externalReferences: 0,
      bggPlayIds: 0,
      relations: 0,
    },
  };

  await prisma.$transaction(async (tx) => {
    const typeIdMap = await importItemTypes(tx, backup, report);
    const itemIdMap = await buildExistingItemMap(tx, backup);

    await importItems(tx, backup, typeIdMap, itemIdMap, report);
    const tagIdMap = await importTags(tx, backup, report);

    await importUserItems(tx, backup, itemIdMap, report);
    await importExternalReferences(tx, backup, itemIdMap, report);
    await importImages(tx, backup, itemIdMap, report);
    await importLinks(tx, backup, itemIdMap, report);
    await importPurchases(tx, backup, itemIdMap, report);
    const preorderIdMap = await importPreorders(tx, backup, itemIdMap, report);
    await importPreorderEvents(tx, backup, preorderIdMap, report);
    await importPlaySessions(tx, backup, itemIdMap, report);
    await importNotes(tx, backup, itemIdMap, report);
    await importRelations(tx, backup, itemIdMap, report);
    await importItemTags(tx, backup, itemIdMap, tagIdMap);
  });

  return report;
}

async function importItemTypes(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  report: JsonImportReportDto,
) {
  const typeIdMap = new Map<string, string>();

  for (const itemType of backup.data.itemTypes) {
    const existing = await tx.itemType.findUnique({
      where: { code: itemType.code },
      select: { id: true },
    });

    if (existing) {
      await tx.itemType.update({
        where: { id: existing.id },
        data: {
          name: itemType.name,
          isSystem: itemType.isSystem,
        },
      });
      typeIdMap.set(itemType.id, existing.id);
      increment(report.updated, "itemTypes");
      continue;
    }

    await tx.itemType.create({
      data: {
        id: itemType.id,
        code: itemType.code,
        name: itemType.name,
        isSystem: itemType.isSystem,
        createdAt: toDate(itemType.createdAt),
        updatedAt: toDate(itemType.updatedAt),
      },
    });
    typeIdMap.set(itemType.id, itemType.id);
    increment(report.created, "itemTypes");
  }

  return typeIdMap;
}

async function buildExistingItemMap(
  tx: BackupTransaction,
  backup: JsonBackupInput,
) {
  const itemIdMap = new Map<string, string>();
  const keys = backup.data.externalReferences.map((reference) => ({
    provider: reference.provider,
    externalId: reference.externalId,
  }));

  if (keys.length > 0) {
    const existingReferences = await tx.externalReference.findMany({
      where: {
        OR: keys,
      },
      select: {
        provider: true,
        externalId: true,
        itemId: true,
      },
    });
    const existingByReference = new Map(
      existingReferences.map((reference) => [
        referenceKey(reference.provider, reference.externalId),
        reference.itemId,
      ]),
    );

    for (const reference of backup.data.externalReferences) {
      const existingItemId = existingByReference.get(
        referenceKey(reference.provider, reference.externalId),
      );

      if (existingItemId && !itemIdMap.has(reference.itemId)) {
        itemIdMap.set(reference.itemId, existingItemId);
      }
    }
  }

  for (const item of backup.data.items) {
    if (!itemIdMap.has(item.id)) {
      itemIdMap.set(item.id, item.id);
    }
  }

  return itemIdMap;
}

async function importItems(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  typeIdMap: Map<string, string>,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const item of backup.data.items) {
    const itemId = itemIdMap.get(item.id) ?? item.id;
    const existing = await tx.item.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    const data = {
      typeId: typeIdMap.get(item.typeId) ?? item.typeId,
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
      sourceMode: item.sourceMode,
      categories: item.categories,
      mechanics: item.mechanics,
      designers: item.designers,
      artists: item.artists,
      publishers: item.publishers,
      deletedAt: nullableDate(item.deletedAt),
      updatedAt: toDate(item.updatedAt),
    };

    if (existing) {
      await tx.item.update({
        where: { id: itemId },
        data,
      });
      increment(report.updated, "items");
      continue;
    }

    await tx.item.create({
      data: {
        id: itemId,
        ...data,
        createdAt: toDate(item.createdAt),
      },
    });
    increment(report.created, "items");
  }
}

async function importTags(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  report: JsonImportReportDto,
) {
  const tagIdMap = new Map<string, string>();

  for (const tag of backup.data.tags) {
    const existing = await tx.tag.findUnique({
      where: { name: tag.name },
      select: { id: true },
    });

    if (existing) {
      await tx.tag.update({
        where: { id: existing.id },
        data: {
          color: tag.color,
        },
      });
      tagIdMap.set(tag.id, existing.id);
      increment(report.updated, "tags");
      continue;
    }

    await tx.tag.create({
      data: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdAt: toDate(tag.createdAt),
        updatedAt: toDate(tag.updatedAt),
      },
    });
    tagIdMap.set(tag.id, tag.id);
    increment(report.created, "tags");
  }

  return tagIdMap;
}

async function importUserItems(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const userItem of backup.data.userItems) {
    const itemId = itemIdMap.get(userItem.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.userItem.findUnique({
      where: { itemId },
      select: { id: true },
    });
    const data = {
      owned: userItem.owned,
      wishlist: userItem.wishlist,
      status: userItem.status,
      location: userItem.location,
      personalRating: userItem.personalRating,
      notes: userItem.notes,
      interestLevel: userItem.interestLevel,
      decisionNotes: userItem.decisionNotes,
      updatedAt: toDate(userItem.updatedAt),
    };

    if (existing) {
      await tx.userItem.update({
        where: { itemId },
        data,
      });
      increment(report.updated, "userItems");
      continue;
    }

    await tx.userItem.create({
      data: {
        id: userItem.id,
        itemId,
        ...data,
        createdAt: toDate(userItem.createdAt),
      },
    });
    increment(report.created, "userItems");
  }
}

async function importExternalReferences(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const reference of backup.data.externalReferences) {
    const itemId = itemIdMap.get(reference.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.externalReference.findUnique({
      where: {
        provider_externalId: {
          provider: reference.provider,
          externalId: reference.externalId,
        },
      },
      select: { id: true, itemId: true },
    });

    if (existing) {
      if (existing.itemId !== itemId) {
        report.skippedDuplicates.externalReferences += 1;
        continue;
      }

      await tx.externalReference.update({
        where: { id: existing.id },
        data: {
          url: reference.url,
          lastSync: nullableDate(reference.lastSync),
        },
      });
      increment(report.updated, "externalReferences");
      continue;
    }

    await tx.externalReference.create({
      data: {
        id: reference.id,
        itemId,
        provider: reference.provider,
        externalId: reference.externalId,
        url: reference.url,
        lastSync: nullableDate(reference.lastSync),
      },
    });
    increment(report.created, "externalReferences");
  }
}

async function importImages(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const image of backup.data.images) {
    const itemId = itemIdMap.get(image.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.image.findUnique({
      where: { id: image.id },
      select: { id: true },
    });

    await tx.image.upsert({
      where: { id: image.id },
      update: {
        itemId,
        type: image.type,
        provider: image.provider,
        url: image.url,
        path: image.path,
        caption: image.caption,
        sortOrder: image.sortOrder,
      },
      create: {
        id: image.id,
        itemId,
        type: image.type,
        provider: image.provider,
        url: image.url,
        path: image.path,
        caption: image.caption,
        sortOrder: image.sortOrder,
        createdAt: toDate(image.createdAt),
      },
    });
    increment(existing ? report.updated : report.created, "images");
  }
}

async function importLinks(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const link of backup.data.links) {
    const itemId = itemIdMap.get(link.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.link.findUnique({
      where: { id: link.id },
      select: { id: true },
    });

    await tx.link.upsert({
      where: { id: link.id },
      update: {
        itemId,
        type: link.type,
        url: link.url,
        title: link.title,
      },
      create: {
        id: link.id,
        itemId,
        type: link.type,
        url: link.url,
        title: link.title,
      },
    });
    increment(existing ? report.updated : report.created, "links");
  }
}

async function importPurchases(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const purchase of backup.data.purchases) {
    const itemId = itemIdMap.get(purchase.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.purchase.findUnique({
      where: { id: purchase.id },
      select: { id: true },
    });

    await tx.purchase.upsert({
      where: { id: purchase.id },
      update: {
        itemId,
        shop: purchase.shop,
        price: purchase.price,
        currency: purchase.currency,
        deliveryCost: purchase.deliveryCost,
        discount: purchase.discount,
        totalPrice: purchase.totalPrice,
        purchaseDate: nullableDate(purchase.purchaseDate),
        comment: purchase.comment,
        updatedAt: toDate(purchase.updatedAt),
      },
      create: {
        id: purchase.id,
        itemId,
        shop: purchase.shop,
        price: purchase.price,
        currency: purchase.currency,
        deliveryCost: purchase.deliveryCost,
        discount: purchase.discount,
        totalPrice: purchase.totalPrice,
        purchaseDate: nullableDate(purchase.purchaseDate),
        comment: purchase.comment,
        createdAt: toDate(purchase.createdAt),
        updatedAt: toDate(purchase.updatedAt),
      },
    });
    increment(existing ? report.updated : report.created, "purchases");
  }
}

async function importPreorders(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  const preorderIdMap = new Map<string, string>();

  for (const preorder of backup.data.preorders) {
    const itemId = itemIdMap.get(preorder.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.preorder.findUnique({
      where: { id: preorder.id },
      select: { id: true },
    });

    await tx.preorder.upsert({
      where: { id: preorder.id },
      update: {
        itemId,
        shop: preorder.shop,
        price: preorder.price,
        currency: preorder.currency,
        orderDate: nullableDate(preorder.orderDate),
        expectedDate: nullableDate(preorder.expectedDate),
        receivedDate: nullableDate(preorder.receivedDate),
        trackingNumber: preorder.trackingNumber,
        status: preorder.status,
        comment: preorder.comment,
        updatedAt: toDate(preorder.updatedAt),
      },
      create: {
        id: preorder.id,
        itemId,
        shop: preorder.shop,
        price: preorder.price,
        currency: preorder.currency,
        orderDate: nullableDate(preorder.orderDate),
        expectedDate: nullableDate(preorder.expectedDate),
        receivedDate: nullableDate(preorder.receivedDate),
        trackingNumber: preorder.trackingNumber,
        status: preorder.status,
        comment: preorder.comment,
        createdAt: toDate(preorder.createdAt),
        updatedAt: toDate(preorder.updatedAt),
      },
    });
    preorderIdMap.set(preorder.id, preorder.id);
    increment(existing ? report.updated : report.created, "preorders");
  }

  return preorderIdMap;
}

async function importPreorderEvents(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  preorderIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const preorder of backup.data.preorders) {
    for (const event of preorder.events) {
      const preorderId = preorderIdMap.get(event.preorderId);

      if (!preorderId) {
        continue;
      }

      const existing = await tx.preorderEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      });

      await tx.preorderEvent.upsert({
        where: { id: event.id },
        update: {
          preorderId,
          type: event.type,
          oldValue: event.oldValue,
          newValue: event.newValue,
          reason: event.reason,
          comment: event.comment,
        },
        create: {
          id: event.id,
          preorderId,
          type: event.type,
          oldValue: event.oldValue,
          newValue: event.newValue,
          reason: event.reason,
          comment: event.comment,
          createdAt: toDate(event.createdAt),
        },
      });
      increment(
        existing ? report.updated : report.created,
        "preorderEvents",
      );
    }
  }
}

async function importPlaySessions(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const playSession of backup.data.playSessions) {
    const itemId = itemIdMap.get(playSession.itemId);

    if (!itemId) {
      continue;
    }

    if (playSession.bggPlayId) {
      const existingByBggId = await tx.playSession.findUnique({
        where: { bggPlayId: playSession.bggPlayId },
        select: { id: true },
      });

      if (existingByBggId && existingByBggId.id !== playSession.id) {
        report.skippedDuplicates.bggPlayIds += 1;
        continue;
      }
    }

    const existing = await tx.playSession.findUnique({
      where: { id: playSession.id },
      select: { id: true },
    });

    await tx.playSession.upsert({
      where: { id: playSession.id },
      update: {
        itemId,
        playedAt: toDate(playSession.playedAt),
        playersCount: playSession.playersCount,
        durationMinutes: playSession.durationMinutes,
        result: playSession.result,
        score: playSession.score,
        scenario: playSession.scenario,
        playerNames: playSession.playerNames,
        usedItemIds: playSession.usedItemIds
          .map((usedItemId) => itemIdMap.get(usedItemId))
          .filter((usedItemId): usedItemId is string => Boolean(usedItemId)),
        notes: playSession.notes,
        source: playSession.source,
        bggPlayId: playSession.bggPlayId,
        locallyModifiedAt: nullableDate(playSession.locallyModifiedAt),
        importedAt: nullableDate(playSession.importedAt),
        updatedAt: toDate(playSession.updatedAt),
      },
      create: {
        id: playSession.id,
        itemId,
        playedAt: toDate(playSession.playedAt),
        playersCount: playSession.playersCount,
        durationMinutes: playSession.durationMinutes,
        result: playSession.result,
        score: playSession.score,
        scenario: playSession.scenario,
        playerNames: playSession.playerNames,
        usedItemIds: playSession.usedItemIds
          .map((usedItemId) => itemIdMap.get(usedItemId))
          .filter((usedItemId): usedItemId is string => Boolean(usedItemId)),
        notes: playSession.notes,
        source: playSession.source,
        bggPlayId: playSession.bggPlayId,
        locallyModifiedAt: nullableDate(playSession.locallyModifiedAt),
        importedAt: nullableDate(playSession.importedAt),
        createdAt: toDate(playSession.createdAt),
        updatedAt: toDate(playSession.updatedAt),
      },
    });
    increment(existing ? report.updated : report.created, "playSessions");
  }
}

async function importNotes(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const note of backup.data.notes) {
    const itemId = itemIdMap.get(note.itemId);

    if (!itemId) {
      continue;
    }

    const existing = await tx.note.findUnique({
      where: { id: note.id },
      select: { id: true },
    });

    await tx.note.upsert({
      where: { id: note.id },
      update: {
        itemId,
        title: note.title,
        body: note.body,
        updatedAt: toDate(note.updatedAt),
      },
      create: {
        id: note.id,
        itemId,
        title: note.title,
        body: note.body,
        createdAt: toDate(note.createdAt),
        updatedAt: toDate(note.updatedAt),
      },
    });
    increment(existing ? report.updated : report.created, "notes");
  }
}

async function importRelations(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  report: JsonImportReportDto,
) {
  for (const relation of backup.data.relations) {
    const parentItemId = itemIdMap.get(relation.parentItemId);
    const childItemId = itemIdMap.get(relation.childItemId);

    if (!parentItemId || !childItemId || parentItemId === childItemId) {
      report.skippedDuplicates.relations += 1;
      continue;
    }

    const uniqueRelation = {
      parentItemId,
      childItemId,
      relationType: relation.relationType,
    };
    const existing = await tx.itemRelation.findUnique({
      where: {
        parentItemId_childItemId_relationType: uniqueRelation,
      },
      select: { id: true },
    });

    await tx.itemRelation.upsert({
      where: {
        parentItemId_childItemId_relationType: uniqueRelation,
      },
      update: {
        comment: relation.comment,
        updatedAt: toDate(relation.updatedAt),
      },
      create: {
        id: relation.id,
        parentItemId,
        childItemId,
        relationType: relation.relationType,
        comment: relation.comment,
        createdAt: toDate(relation.createdAt),
        updatedAt: toDate(relation.updatedAt),
      },
    });
    increment(existing ? report.updated : report.created, "relations");
  }
}

async function importItemTags(
  tx: BackupTransaction,
  backup: JsonBackupInput,
  itemIdMap: Map<string, string>,
  tagIdMap: Map<string, string>,
) {
  const tagIdsByItemId = new Map<string, string[]>();

  for (const itemTag of backup.data.itemTags) {
    const itemId = itemIdMap.get(itemTag.itemId);
    const tagId = tagIdMap.get(itemTag.tagId);

    if (!itemId || !tagId) {
      continue;
    }

    tagIdsByItemId.set(itemId, [...(tagIdsByItemId.get(itemId) ?? []), tagId]);
  }

  for (const [itemId, tagIds] of tagIdsByItemId.entries()) {
    await tx.item.update({
      where: { id: itemId },
      data: {
        tags: {
          set: Array.from(new Set(tagIds)).map((id) => ({ id })),
        },
      },
    });
  }
}

function referenceKey(provider: string, externalId: string) {
  return `${provider}:${externalId}`;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function toDate(value: string) {
  return new Date(value);
}

function nullableDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function decimalToNumber(value: unknown) {
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
