import { z } from "zod";

export const legacyResponseViewSchema = z.literal("legacy");

export const legacyStoredUserItemStatusSchema = z.enum([
  "owned",
  "wishlist",
  "preordered",
  "played",
]);
