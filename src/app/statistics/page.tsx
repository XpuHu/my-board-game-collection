import { Suspense } from "react";

import { StatisticsPageClient } from "./statistics-page-client";

export default function StatisticsPage() {
  return (
    <Suspense>
      <StatisticsPageClient />
    </Suspense>
  );
}
