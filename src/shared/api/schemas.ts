import { z } from "zod";

import {
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
