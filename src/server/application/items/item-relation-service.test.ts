import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";

import {
  createItemRelation,
  deleteItemRelation,
  updateItemRelation,
} from "./item-service";

let parentItemId: string;
let childItemId: string;

beforeAll(async () => {
  const itemType = await prisma.itemType.findUniqueOrThrow({
    where: { code: "base_game" },
  });
  const [parent, child] = await Promise.all([
    prisma.item.create({
      data: {
        typeId: itemType.id,
        title: `Relation parent ${crypto.randomUUID()}`,
      },
    }),
    prisma.item.create({
      data: {
        typeId: itemType.id,
        title: `Relation child ${crypto.randomUUID()}`,
      },
    }),
  ]);
  parentItemId = parent.id;
  childItemId = child.id;
});

describe("item relation editing", () => {
  it("creates, updates and deletes a relation from the current item perspective", async () => {
    const created = await createItemRelation(parentItemId, {
      relatedItemId: childItemId,
      direction: "child",
      relationType: "expands",
      comment: "Первичная связь",
    });
    const relation = created.relations[0];

    expect(relation).toMatchObject({
      direction: "child",
      relationType: "expands",
      comment: "Первичная связь",
    });
    expect(relation?.relatedItem.id).toBe(childItemId);

    const updated = await updateItemRelation(parentItemId, relation!.id, {
      direction: "parent",
      relationType: "requires",
      comment: "Обновлённая связь",
    });

    expect(updated.relations[0]).toMatchObject({
      direction: "parent",
      relationType: "requires",
      comment: "Обновлённая связь",
    });

    const deleted = await deleteItemRelation(parentItemId, relation!.id);
    expect(deleted.relations).toEqual([]);
  });

  it("rejects a relation from an item to itself", async () => {
    await expect(
      createItemRelation(parentItemId, {
        relatedItemId: parentItemId,
        direction: "child",
        relationType: "related",
      }),
    ).rejects.toMatchObject({
      code: "ITEM_RELATION_CONFLICT",
    });
  });
});
