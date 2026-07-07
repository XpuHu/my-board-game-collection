import { z } from "zod";

import {
  linkTypes,
  itemStatuses,
  itemTypeCodes,
  playResults,
  preorderStatuses,
  providerCodes,
} from "./types";

export const providerCodeSchema = z.enum(providerCodes);
export const itemTypeCodeSchema = z.enum(itemTypeCodes);
export const itemStatusSchema = z.enum(itemStatuses);
export const playResultSchema = z.enum(playResults);
export const preorderStatusSchema = z.enum(preorderStatuses);

const nullableStringSchema = z.string().trim().min(1).nullable();

const isoDateStringSchema = z.string().refine((value) => {
  return !Number.isNaN(Date.parse(value));
}, "Expected an ISO 8601 date string");

const optionalIsoDateStringSchema = isoDateStringSchema.nullable().optional();

const uuidSchema = z.string().uuid();

export const createPurchaseRequestSchema = z
  .object({
    shop: z.string().trim().min(1),
    price: z.number().nonnegative(),
    currency: z.string().trim().min(3).max(3),
    deliveryCost: z.number().nonnegative().nullable().optional(),
    discount: z.number().nonnegative().nullable().optional(),
    totalPrice: z.number().nonnegative().nullable().optional(),
    purchaseDate: optionalIsoDateStringSchema,
    comment: nullableStringSchema.optional(),
  })
  .strict();

export const updateUserItemRequestSchema = z
  .object({
    status: itemStatusSchema.optional(),
    owned: z.boolean().optional(),
    wishlist: z.boolean().optional(),
    location: nullableStringSchema.optional(),
    personalRating: z.number().int().min(1).max(10).nullable().optional(),
    notes: nullableStringSchema.optional(),
    interestLevel: z.number().int().min(1).max(5).nullable().optional(),
    decisionNotes: nullableStringSchema.optional(),
    tagIds: z.array(uuidSchema).optional(),
  })
  .strict();

export const addToCollectionRequestSchema = z
  .object({
    purchase: createPurchaseRequestSchema.optional(),
    location: nullableStringSchema.optional(),
    personalRating: z.number().int().min(1).max(10).nullable().optional(),
    notes: nullableStringSchema.optional(),
  })
  .strict();

export const addToWishlistRequestSchema = z.object({}).strict();

export const importExternalItemRequestSchema = z
  .object({
    provider: providerCodeSchema,
    externalId: z.string().trim().min(1),
    typeId: uuidSchema.optional(),
    target: z.enum(["collection", "wishlist", "reference_only"]).optional(),
  })
  .strict();

export const createPlaySessionRequestSchema = z
  .object({
    playedAt: isoDateStringSchema,
    playersCount: z.number().int().positive().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    result: playResultSchema.nullable().optional(),
    score: nullableStringSchema.optional(),
    scenario: nullableStringSchema.optional(),
    playerNames: z.array(z.string().trim().min(1)).optional(),
    usedItemIds: z.array(uuidSchema).optional(),
    notes: nullableStringSchema.optional(),
  })
  .strict();

export const updatePlaySessionRequestSchema =
  createPlaySessionRequestSchema.partial();

export const createPreorderRequestSchema = z
  .object({
    shop: z.string().trim().min(1),
    price: z.number().nonnegative(),
    currency: z.string().trim().min(3).max(3),
    orderDate: optionalIsoDateStringSchema,
    expectedDate: optionalIsoDateStringSchema,
    receivedDate: optionalIsoDateStringSchema,
    trackingNumber: nullableStringSchema.optional(),
    status: preorderStatusSchema,
    comment: nullableStringSchema.optional(),
  })
  .strict();

export const updatePreorderExpectedDateRequestSchema = z
  .object({
    expectedDate: isoDateStringSchema.nullable(),
    reason: nullableStringSchema.optional(),
    comment: nullableStringSchema.optional(),
  })
  .strict();

export const updateBggSettingsRequestSchema = z
  .object({
    username: z.string().trim().min(1),
  })
  .strict();

export const syncBggPlaysRequestSchema = z
  .object({
    username: z.string().trim().min(1).optional(),
    since: isoDateStringSchema.nullable().optional(),
  })
  .strict();

export const syncItemRequestSchema = z
  .object({
    provider: providerCodeSchema.optional(),
  })
  .strict();

export const settingsRequestSchema = z
  .object({
    language: z.enum(["ru", "en"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    defaultItemTypeId: uuidSchema.nullable().optional(),
    defaultProvider: providerCodeSchema.nullable().optional(),
    providerPriority: z.array(providerCodeSchema).optional(),
    autoSyncItemReference: z.boolean().optional(),
    bggUsername: nullableStringSchema.optional(),
    lastBggPlaySync: isoDateStringSchema.nullable().optional(),
  })
  .strict();

const stringArraySchema = z.array(z.string());

const backupItemTypeSchema = z
  .object({
    id: uuidSchema,
    code: itemTypeCodeSchema,
    name: z.string().trim().min(1),
    isSystem: z.boolean(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupItemSchema = z
  .object({
    id: uuidSchema,
    typeId: uuidSchema,
    title: z.string().trim().min(1),
    originalTitle: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    year: z.number().int().nullable().optional(),
    minPlayers: z.number().int().positive().nullable().optional(),
    maxPlayers: z.number().int().positive().nullable().optional(),
    minPlayTime: z.number().int().positive().nullable().optional(),
    maxPlayTime: z.number().int().positive().nullable().optional(),
    minAge: z.number().int().positive().nullable().optional(),
    complexity: z.number().nonnegative().nullable().optional(),
    rating: z.number().nonnegative().nullable().optional(),
    sourceMode: z.enum(["imported", "manual"]),
    categories: stringArraySchema,
    mechanics: stringArraySchema,
    designers: stringArraySchema,
    artists: stringArraySchema,
    publishers: stringArraySchema,
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
    deletedAt: isoDateStringSchema.nullable().optional(),
  })
  .strict();

const backupUserItemSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    status: itemStatusSchema,
    owned: z.boolean(),
    wishlist: z.boolean(),
    location: z.string().nullable().optional(),
    personalRating: z.number().int().min(1).max(10).nullable().optional(),
    notes: z.string().nullable().optional(),
    interestLevel: z.number().int().min(1).max(5).nullable().optional(),
    decisionNotes: z.string().nullable().optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupExternalReferenceSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    provider: providerCodeSchema,
    externalId: z.string().trim().min(1),
    url: z.string().nullable().optional(),
    lastSync: isoDateStringSchema.nullable().optional(),
  })
  .strict();

const backupImageSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    type: z.enum(["reference", "user"]),
    provider: providerCodeSchema.nullable().optional(),
    url: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    sortOrder: z.number().int(),
    createdAt: isoDateStringSchema,
  })
  .strict();

const backupLinkSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    type: z.enum(linkTypes),
    url: z.string().trim().min(1),
    title: z.string().nullable().optional(),
  })
  .strict();

const backupPurchaseSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    shop: z.string().trim().min(1),
    price: z.number().nonnegative(),
    currency: z.string().trim().min(3).max(3),
    deliveryCost: z.number().nonnegative().nullable().optional(),
    discount: z.number().nonnegative().nullable().optional(),
    totalPrice: z.number().nonnegative(),
    purchaseDate: isoDateStringSchema.nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupPreorderEventSchema = z
  .object({
    id: uuidSchema,
    preorderId: uuidSchema,
    type: z.string().trim().min(1),
    oldValue: z.string().nullable().optional(),
    newValue: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: isoDateStringSchema,
  })
  .strict();

const backupPreorderSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    itemTitle: z.string(),
    shop: z.string().trim().min(1),
    price: z.number().nonnegative(),
    currency: z.string().trim().min(3).max(3),
    orderDate: isoDateStringSchema.nullable().optional(),
    expectedDate: isoDateStringSchema.nullable().optional(),
    receivedDate: isoDateStringSchema.nullable().optional(),
    trackingNumber: z.string().nullable().optional(),
    status: preorderStatusSchema,
    comment: z.string().nullable().optional(),
    events: z.array(backupPreorderEventSchema),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupPlaySessionSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    playedAt: isoDateStringSchema,
    playersCount: z.number().int().positive().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    result: playResultSchema.nullable().optional(),
    score: z.string().nullable().optional(),
    scenario: z.string().nullable().optional(),
    playerNames: stringArraySchema,
    usedItemIds: z.array(uuidSchema),
    notes: z.string().nullable().optional(),
    source: z.enum(["manual", "boardgamegeek"]),
    bggPlayId: z.string().nullable().optional(),
    locallyModifiedAt: isoDateStringSchema.nullable().optional(),
    importedAt: isoDateStringSchema.nullable().optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupNoteSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema,
    title: z.string().nullable().optional(),
    body: z.string(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupRelationSchema = z
  .object({
    id: uuidSchema,
    parentItemId: uuidSchema,
    childItemId: uuidSchema,
    relationType: z.string().trim().min(1),
    comment: z.string().nullable().optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupTagSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1),
    color: z.string().nullable().optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  })
  .strict();

const backupItemTagSchema = z
  .object({
    itemId: uuidSchema,
    tagId: uuidSchema,
  })
  .strict();

export const jsonBackupSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: isoDateStringSchema,
    data: z
      .object({
        itemTypes: z.array(backupItemTypeSchema),
        items: z.array(backupItemSchema),
        userItems: z.array(backupUserItemSchema),
        externalReferences: z.array(backupExternalReferenceSchema),
        images: z.array(backupImageSchema),
        links: z.array(backupLinkSchema),
        purchases: z.array(backupPurchaseSchema),
        preorders: z.array(backupPreorderSchema),
        playSessions: z.array(backupPlaySessionSchema),
        notes: z.array(backupNoteSchema),
        relations: z.array(backupRelationSchema),
        tags: z.array(backupTagSchema),
        itemTags: z.array(backupItemTagSchema),
      })
      .strict(),
  })
  .strict();

export type CreatePurchaseInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdateUserItemInput = z.infer<typeof updateUserItemRequestSchema>;
export type AddToCollectionInput = z.infer<typeof addToCollectionRequestSchema>;
export type AddToWishlistInput = z.infer<typeof addToWishlistRequestSchema>;
export type ImportExternalItemInput = z.infer<
  typeof importExternalItemRequestSchema
>;
export type CreatePlaySessionInput = z.infer<
  typeof createPlaySessionRequestSchema
>;
export type UpdatePlaySessionInput = z.infer<
  typeof updatePlaySessionRequestSchema
>;
export type CreatePreorderInput = z.infer<typeof createPreorderRequestSchema>;
export type UpdatePreorderExpectedDateInput = z.infer<
  typeof updatePreorderExpectedDateRequestSchema
>;
export type UpdateBggSettingsInput = z.infer<
  typeof updateBggSettingsRequestSchema
>;
export type SyncBggPlaysInput = z.infer<typeof syncBggPlaysRequestSchema>;
export type SyncItemInput = z.infer<typeof syncItemRequestSchema>;
export type SettingsInput = z.infer<typeof settingsRequestSchema>;
export type JsonBackupInput = z.infer<typeof jsonBackupSchema>;
