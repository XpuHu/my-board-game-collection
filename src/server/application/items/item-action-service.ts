import {
  expansionSelectionSchema,
  prepareExpansionImports,
  linkExpansionsInTransaction,
} from "./expansion-service";
import { z } from "zod";
import {
  addToCollectionRequestSchema,
  createPreorderRequestSchema,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";
import {
  createItemSchema,
  createItemInTransaction,
  addToCollectionInTransaction,
} from "./item-service";
import {
  createPreorderInTransaction,
  createPreorderPositionsInTransaction,
} from "@/server/application/preorders/preorder-service";
import { runCommand } from "./command-receipt";
export const itemActionSchema = z
  .object({
    operationId: z.string().uuid(),
    itemId: z.string().uuid().optional(),
    manual: createItemSchema.optional(),
    target: z.enum(["collection", "preorder"]),
    collection: addToCollectionRequestSchema.optional(),
    preorder: createPreorderRequestSchema.optional(),
    expansions: z.array(expansionSelectionSchema).max(50).optional(),
    accessories: z.array(expansionSelectionSchema).max(50).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.expansions?.length || v.accessories?.length) &&
      v.target !== "preorder"
    )
      c.addIssue({
        code: "custom",
        path: ["expansions"],
        message: "Дополнения доступны для предзаказа",
      });
    for (const field of ["expansions", "accessories"] as const)
      v[field]?.forEach((item, i) => {
        if (v.preorder?.pricingMode !== "lot" && item.price === undefined)
          c.addIssue({
            code: "custom",
            path: [field, i, "price"],
            message:
              "Укажите отдельную цену позиции или выберите цену всего лота",
          });
      });
    if (Boolean(v.itemId) === Boolean(v.manual))
      c.addIssue({
        code: "custom",
        path: ["itemId"],
        message: "Choose an existing item or manual creation",
      });
    if (v.target === "preorder" && !v.preorder)
      c.addIssue({
        code: "custom",
        path: ["preorder"],
        message: "Preorder data is required",
      });
  });
export type ItemActionInput = z.infer<typeof itemActionSchema>;
export async function executeItemAction(input: ItemActionInput) {
  const { operationId, ...payload } = itemActionSchema.parse(input);
  let prepared: Awaited<ReturnType<typeof prepareExpansionImports>> = new Map();
  let preparedAccessories: Awaited<ReturnType<typeof prepareExpansionImports>> =
    new Map();
  return runCommand(
    operationId,
    "item-action",
    payload,
    async (tx) => {
      const itemId =
        payload.itemId ?? (await createItemInTransaction(tx, payload.manual!));
      const item = await tx.item.findFirst({
        where: { id: itemId, deletedAt: null },
      });
      if (!item)
        throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
      let preorderId: string | null = null;
      if (payload.target === "collection")
        await addToCollectionInTransaction(
          tx,
          itemId,
          payload.collection ?? {},
        );
      else {
        const root = await createPreorderInTransaction(
          tx,
          itemId,
          payload.preorder!,
        );
        preorderId = root.id;
        const expansions = await linkExpansionsInTransaction(
          tx,
          itemId,
          payload.expansions ?? [],
          prepared,
        );
        const accessories = await linkExpansionsInTransaction(
          tx,
          itemId,
          payload.accessories ?? [],
          preparedAccessories,
          "accessory",
        );
        const positions = [...expansions, ...accessories];
        if (
          new Set(positions.map((position) => position.itemId)).size !==
          positions.length
        )
          throw ApiError.badRequest(
            "DUPLICATE_POSITION",
            "Позиции лота должны отличаться",
          );
        const children = await createPreorderPositionsInTransaction(
          tx,
          root,
          positions,
        );
        const expansionPreorderIds = children
          .slice(0, expansions.length)
          .map(({ id }) => id);
        const accessoryPreorderIds = children
          .slice(expansions.length)
          .map(({ id }) => id);
        return {
          itemId,
          title: item.title,
          preorderId,
          expansionPreorderIds,
          accessoryPreorderIds,
        };
      }
      return { itemId, title: item.title, preorderId };
    },
    [...(payload.expansions ?? []), ...(payload.accessories ?? [])].some(
      (item) => item.external,
    )
      ? async () => {
          prepared = await prepareExpansionImports(payload.expansions ?? []);
          preparedAccessories = await prepareExpansionImports(
            payload.accessories ?? [],
            "accessory",
          );
        }
      : undefined,
  );
}
