import { requireFullProduct } from "@/server/config/product-mode";
import { Suspense } from "react";

import { StatisticsPageClient } from "./statistics-page-client";

export default function StatisticsPage() {
  requireFullProduct();
  return (
    <Suspense>
      <StatisticsPageClient />
    </Suspense>
  );
}
