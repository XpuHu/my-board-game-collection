import { Suspense } from "react";

import { CollectionPageClient } from "./collection-page-client";

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionPageClient />
    </Suspense>
  );
}
