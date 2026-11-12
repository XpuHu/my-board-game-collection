import { Suspense } from "react";
import { CollectionItemPageClient } from "@/app/collection/[itemId]/collection-item-page-client";
export default async function ItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  return (
    <Suspense>
      <CollectionItemPageClient itemId={(await params).itemId} neutral />
    </Suspense>
  );
}
