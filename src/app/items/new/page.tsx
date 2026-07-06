import { ExternalImportPageClient } from "./external-import-page-client";
import type { ImportExternalItemRequest } from "@/shared/api";

type NewItemPageProps = {
  searchParams: Promise<{
    target?: string;
  }>;
};

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  const params = await searchParams;

  return (
    <ExternalImportPageClient initialTarget={parseTarget(params.target)} />
  );
}

function parseTarget(
  value?: string,
): NonNullable<ImportExternalItemRequest["target"]> | undefined {
  if (
    value === "collection" ||
    value === "wishlist" ||
    value === "reference_only"
  ) {
    return value;
  }

  return undefined;
}
