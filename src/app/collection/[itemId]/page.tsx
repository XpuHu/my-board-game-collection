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

  return (
    <Suspense>
      <CollectionItemPageClient itemId={itemId} />
    </Suspense>
  );
}
