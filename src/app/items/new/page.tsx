import { ExternalImportPageClient } from "./external-import-page-client";

type ManualQuickAction =
  | "collection"
  | "play"
  | "wishlist"
  | "preorder"
  | "reference_only";

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
): ManualQuickAction | undefined {
  if (
    value === "collection" ||
    value === "play" ||
    value === "wishlist" ||
    value === "preorder" ||
    value === "reference_only"
  ) {
    return value;
  }

  return undefined;
}
