import { getProductFeatures } from "@/server/config/product-mode";
import { ExternalImportPageClient } from "./external-import-page-client";

type ManualQuickAction =
  "collection" | "play" | "wishlist" | "preorder" | "reference_only";

type NewItemPageProps = {
  searchParams: Promise<{
    target?: string;
    itemId?: string;
  }>;
};

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  const params = await searchParams;

  return (
    <ExternalImportPageClient
      initialItemId={params.itemId}
      initialTarget={
        getProductFeatures().mode === "mvp" &&
        !["collection", "preorder"].includes(params.target ?? "collection")
          ? "collection"
          : parseTarget(params.target)
      }
    />
  );
}

function parseTarget(value?: string): ManualQuickAction | undefined {
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
