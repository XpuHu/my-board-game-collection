import { z } from "zod";
import {
  updateItemRequestSchema,
  updateImageRequestSchema,
  createImageRequestSchema,
  createLinkRequestSchema,
  createExternalReferenceRequestSchema,
  createItemRelationRequestSchema,
} from "@/shared/api";
import { ApiError } from "@/server/api/errors";
import { runCommand } from "./command-receipt";
import { syncItemTaxonomy } from "./taxonomy-service";
const entry = <T extends z.ZodType>(data: T) =>
  z.object({ id: z.string().uuid().optional(), data }).strict();
const ids = z.array(z.string().uuid()).default([]);
export const referenceCommandSchema = z
  .object({
    operationId: z.string().uuid(),
    item: updateItemRequestSchema,
    images: z.array(entry(updateImageRequestSchema)).default([]),
    links: z.array(entry(createLinkRequestSchema)).default([]),
    references: z
      .array(entry(createExternalReferenceRequestSchema))
      .default([]),
    relations: z.array(entry(createItemRelationRequestSchema)).default([]),
    removedImageIds: ids,
    removedLinkIds: ids,
    removedReferenceIds: ids,
    removedRelationIds: ids,
  })
  .strict();
export async function saveReferenceCommand(
  itemId: string,
  input: z.infer<typeof referenceCommandSchema>,
) {
  const { operationId, ...payload } = referenceCommandSchema.parse(input);
  return runCommand(
    operationId,
    "reference-data",
    { itemId, ...payload },
    async (tx) => {
      if (
        !(await tx.item.findFirst({ where: { id: itemId, deletedAt: null } }))
      )
        throw ApiError.notFound("ITEM_NOT_FOUND", "Item was not found");
      await tx.item.update({ where: { id: itemId }, data: payload.item });
      await syncItemTaxonomy(tx, itemId, payload.item);
      const fail = () =>
        ApiError.notFound(
          "ITEM_CHILD_NOT_FOUND",
          "Resource does not belong to this item",
        );
      for (const id of payload.removedImageIds) {
        if (
          !(
            await tx.image.deleteMany({
              where: { id, itemId, type: "reference" },
            })
          ).count
        )
          throw fail();
      }
      for (const id of payload.removedLinkIds) {
        if (!(await tx.link.deleteMany({ where: { id, itemId } })).count)
          throw fail();
      }
      for (const id of payload.removedReferenceIds) {
        if (
          !(await tx.externalReference.deleteMany({ where: { id, itemId } }))
            .count
        )
          throw fail();
      }
      for (const id of payload.removedRelationIds) {
        if (
          !(
            await tx.itemRelation.deleteMany({
              where: {
                id,
                OR: [{ parentItemId: itemId }, { childItemId: itemId }],
              },
            })
          ).count
        )
          throw fail();
      }
      for (const { id, data } of payload.images) {
        const values = { ...data, type: "reference" };
        if (id) {
          if (
            !(
              await tx.image.updateMany({
                where: { id, itemId, type: "reference" },
                data: values,
              })
            ).count
          )
            throw fail();
        } else
          await tx.image.create({
            data: { ...createImageRequestSchema.parse(values), itemId },
          });
      }
      for (const { id, data } of payload.links) {
        if (id) {
          if (
            !(await tx.link.updateMany({ where: { id, itemId }, data })).count
          )
            throw fail();
        } else await tx.link.create({ data: { ...data, itemId } });
      }
      for (const { id, data } of payload.references) {
        if (id) {
          if (
            !(
              await tx.externalReference.updateMany({
                where: { id, itemId },
                data: { ...data, lastSync: null },
              })
            ).count
          )
            throw fail();
        } else await tx.externalReference.create({ data: { ...data, itemId } });
      }
      for (const { id, data } of payload.relations) {
        if (data.relatedItemId === itemId)
          throw ApiError.conflict(
            "ITEM_RELATION_CONFLICT",
            "An item cannot be related to itself",
          );
        if (
          !(await tx.item.findFirst({
            where: { id: data.relatedItemId, deletedAt: null },
          }))
        )
          throw fail();
        const values = {
          parentItemId:
            data.direction === "child" ? itemId : data.relatedItemId,
          childItemId: data.direction === "child" ? data.relatedItemId : itemId,
          relationType: data.relationType,
          comment: data.comment,
        };
        if (id) {
          if (
            !(
              await tx.itemRelation.updateMany({
                where: {
                  id,
                  OR: [{ parentItemId: itemId }, { childItemId: itemId }],
                },
                data: values,
              })
            ).count
          )
            throw fail();
        } else await tx.itemRelation.create({ data: values });
      }
      return { itemId };
    },
  );
}
