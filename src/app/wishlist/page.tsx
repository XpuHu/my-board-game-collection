import { requireFullProduct } from "@/server/config/product-mode";
import { Suspense } from "react";

import { WishlistPageClient } from "./wishlist-page-client";

export default function WishlistPage() {
  requireFullProduct();
  return (
    <Suspense>
      <WishlistPageClient />
    </Suspense>
  );
}
