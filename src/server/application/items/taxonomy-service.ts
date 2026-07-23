import type { Prisma } from "@prisma/client";

export type TaxonomyInput = {
  mechanics?: string[];
  categories?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
};

export function normalizeTaxonomyName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
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
  const mechanics = entries(input.mechanics);
  const categories = entries(input.categories);
  const designers = entries(input.designers);
  const artists = entries(input.artists);
  const publishers = entries(input.publishers);

  await tx.item.update({
    where: { id: itemId },
    data: {
      itemMechanics: mechanics
        ? {
            deleteMany: {},
            create: mechanics.map(({ name, normalizedName }) => ({
              mechanic: {
                connectOrCreate: {
                  where: { normalizedName },
                  create: { name, normalizedName },
                },
              },
            })),
          }
        : undefined,
      itemCategories: categories
        ? {
            deleteMany: {},
            create: categories.map(({ name, normalizedName }) => ({
              category: {
                connectOrCreate: {
                  where: { normalizedName },
                  create: { name, normalizedName },
                },
              },
            })),
          }
        : undefined,
      itemDesigners: designers
        ? {
            deleteMany: {},
            create: designers.map(({ name, normalizedName }) => ({
              designer: {
                connectOrCreate: {
                  where: { normalizedName },
                  create: { name, normalizedName },
                },
              },
            })),
          }
        : undefined,
      itemArtists: artists
        ? {
            deleteMany: {},
            create: artists.map(({ name, normalizedName }) => ({
              artist: {
                connectOrCreate: {
                  where: { normalizedName },
                  create: { name, normalizedName },
                },
              },
            })),
          }
        : undefined,
      itemPublishers: publishers
        ? {
            deleteMany: {},
            create: publishers.map(({ name, normalizedName }) => ({
              publisher: {
                connectOrCreate: {
                  where: { normalizedName },
                  create: { name, normalizedName },
                },
              },
            })),
          }
        : undefined,
    },
  });
}
