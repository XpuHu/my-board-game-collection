import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { parseBggCollection, applyBggCollectionEntry } from "./bgg-import";
import { prisma } from "@/infrastructure/database/prisma";
describe("BGG collection import", () => {
  it("decodes names, ignores unowned, identifies expansions and deduplicates BGG ids", () => {
    const item = (id: string, own: string) =>
      `<item objectid="${id}" subtype="boardgameexpansion"><name>A &amp; B</name><status own="${own}"/><stats><rating value="7.5"/></stats></item>`;
    expect(
      parseBggCollection(
        `<items>${item("1", "1")}${item("1", "1")}${item("2", "0")}</items>`,
      ),
    ).toEqual([
      {
        externalId: "1",
        title: "A & B",
        type: "expansion",
        imageUrl: null,
        rating: 7.5,
      },
    ]);
  });
  it("preserves existing personal fields on repeat import with a new operation", async () => {
    const entry = {
      externalId: String(Math.floor(Math.random() * 1e11)),
      title: `Import ${randomUUID()}`,
      type: "base_game" as const,
      imageUrl: null,
      rating: 7.5,
    };
    const id = randomUUID();
    const first = await applyBggCollectionEntry(id, entry);
    expect(await applyBggCollectionEntry(id, entry)).toEqual(first);
    await prisma.userItem.update({
      where: { itemId: first.itemId },
      data: { personalRating: 4, notes: "Keep notes" },
    });
    expect((await applyBggCollectionEntry(randomUUID(), entry)).result).toBe(
      "unchanged",
    );
    expect(
      await prisma.userItem.findUnique({ where: { itemId: first.itemId } }),
    ).toMatchObject({ personalRating: 4, notes: "Keep notes" });
    expect(
      await prisma.externalReference.count({
        where: { provider: "boardgamegeek", externalId: entry.externalId },
      }),
    ).toBe(1);
  });
});
