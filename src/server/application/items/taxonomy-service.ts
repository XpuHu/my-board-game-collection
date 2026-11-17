import type { Prisma } from "@prisma/client";

export type TaxonomyInput = {
  mechanics?: string[];
  categories?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
};

export type ItemTaxonomyDraft = { itemId: string; input: TaxonomyInput };

export function normalizeTaxonomyName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function ensurePublisher(
  tx: Prisma.TransactionClient,
  value: string,
) {
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeTaxonomyName(name);
  return tx.publisher.upsert({
    where: { normalizedName },
    create: { name, normalizedName },
    update: {},
  });
}

function entries(values: string[] | undefined) {
  if (!values) return undefined;

  const unique = new Map<string, string>();
  values.forEach((value) => {
    const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeTaxonomyName(name);
    if (normalizedName && !unique.has(normalizedName)) {
      unique.set(normalizedName, name);
    }
  });
  return [...unique].map(([normalizedName, name]) => ({
    name,
    normalizedName,
  }));
}

export async function syncItemTaxonomy(
  tx: Prisma.TransactionClient,
  itemId: string,
  input: TaxonomyInput,
) {
  await syncItemTaxonomies(tx, [{ itemId, input }]);
}

export async function syncItemTaxonomies(
  tx: Prisma.TransactionClient,
  batch: ItemTaxonomyDraft[],
) {
  const consolidated = new Map<string, TaxonomyInput>();
  for (const { itemId, input } of batch) {
    const values = consolidated.get(itemId) ?? {};
    for (const key of [
      "mechanics",
      "categories",
      "designers",
      "artists",
      "publishers",
    ] as const)
      if (input[key] !== undefined) values[key] = input[key];
    consolidated.set(itemId, values);
  }
  const items = [...consolidated].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  // Lock parents in a consistent order, then sync each directory once for the
  // entire lot rather than repeating the same round trips for every position.
  for (const [itemId] of items)
    await tx.item.update({
      where: { id: itemId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

  await syncEntries(
    items.map(([itemId, input]) => ({
      itemId,
      values: entries(input.mechanics),
    })),
    (data) => tx.mechanic.createMany({ data, skipDuplicates: true }),
    (names) =>
      tx.mechanic.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true, normalizedName: true },
      }),
    (ids) => tx.itemMechanic.deleteMany({ where: { itemId: { in: ids } } }),
    (links) =>
      tx.itemMechanic.createMany({
        data: links.map(({ itemId, id }) => ({ itemId, mechanicId: id })),
      }),
  );
  await syncEntries(
    items.map(([itemId, input]) => ({
      itemId,
      values: entries(input.categories),
    })),
    (data) => tx.category.createMany({ data, skipDuplicates: true }),
    (names) =>
      tx.category.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true, normalizedName: true },
      }),
    (ids) => tx.itemCategory.deleteMany({ where: { itemId: { in: ids } } }),
    (links) =>
      tx.itemCategory.createMany({
        data: links.map(({ itemId, id }) => ({ itemId, categoryId: id })),
      }),
  );
  await syncEntries(
    items.map(([itemId, input]) => ({
      itemId,
      values: entries(input.designers),
    })),
    (data) => tx.designer.createMany({ data, skipDuplicates: true }),
    (names) =>
      tx.designer.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true, normalizedName: true },
      }),
    (ids) => tx.itemDesigner.deleteMany({ where: { itemId: { in: ids } } }),
    (links) =>
      tx.itemDesigner.createMany({
        data: links.map(({ itemId, id }) => ({ itemId, designerId: id })),
      }),
  );
  await syncEntries(
    items.map(([itemId, input]) => ({
      itemId,
      values: entries(input.artists),
    })),
    (data) => tx.artist.createMany({ data, skipDuplicates: true }),
    (names) =>
      tx.artist.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true, normalizedName: true },
      }),
    (ids) => tx.itemArtist.deleteMany({ where: { itemId: { in: ids } } }),
    (links) =>
      tx.itemArtist.createMany({
        data: links.map(({ itemId, id }) => ({ itemId, artistId: id })),
      }),
  );
  await syncEntries(
    items.map(([itemId, input]) => ({
      itemId,
      values: entries(input.publishers),
    })),
    (data) => tx.publisher.createMany({ data, skipDuplicates: true }),
    (names) =>
      tx.publisher.findMany({
        where: { normalizedName: { in: names } },
        select: { id: true, normalizedName: true },
      }),
    (ids) => tx.itemPublisher.deleteMany({ where: { itemId: { in: ids } } }),
    (links) =>
      tx.itemPublisher.createMany({
        data: links.map(({ itemId, id }) => ({ itemId, publisherId: id })),
      }),
  );
}

async function syncEntries(
  batch: { itemId: string; values: ReturnType<typeof entries> }[],
  create: (values: NonNullable<ReturnType<typeof entries>>) => Promise<unknown>,
  find: (names: string[]) => Promise<{ id: string; normalizedName: string }[]>,
  clearLinks: (itemIds: string[]) => Promise<unknown>,
  link: (links: { itemId: string; id: string }[]) => Promise<unknown>,
) {
  const supplied = batch.filter(
    (
      entry,
    ): entry is {
      itemId: string;
      values: NonNullable<ReturnType<typeof entries>>;
    } => entry.values !== undefined,
  );
  if (!supplied.length) return;
  const unique = new Map(
    supplied.flatMap(({ values }) =>
      values.map((value) => [value.normalizedName, value] as const),
    ),
  );
  if (unique.size) await create([...unique.values()]);
  const stored = unique.size ? await find([...unique.keys()]) : [];
  const byName = new Map(
    stored.map(({ id, normalizedName }) => [normalizedName, id]),
  );
  await clearLinks(supplied.map(({ itemId }) => itemId));
  const links = supplied.flatMap(({ itemId, values }) =>
    values.map(({ normalizedName }) => ({
      itemId,
      id: byName.get(normalizedName)!,
    })),
  );
  if (links.length) await link(links);
}
