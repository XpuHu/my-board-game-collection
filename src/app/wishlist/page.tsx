import { Suspense } from "react";

import { WishlistPageClient } from "./wishlist-page-client";

export default function WishlistPage() {
  return (
    <Suspense>
      <WishlistPageClient />
    </Suspense>
  );
}
