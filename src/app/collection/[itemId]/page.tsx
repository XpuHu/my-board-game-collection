import { getProductFeatures } from "@/server/config/product-mode";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CollectionItemPageClient } from "./collection-item-page-client";

type CollectionItemPageProps = {
  params: Promise<{
    itemId: string;
  }>;
};

export default async function CollectionItemPage({
  params,
}: CollectionItemPageProps) {
  const { itemId } = await params;
  if (getProductFeatures().mode === "mvp")
    redirect(`/items/${encodeURIComponent(itemId)}`);

  return (
    <Suspense>
      <CollectionItemPageClient itemId={itemId} />
    </Suspense>
  );
}
