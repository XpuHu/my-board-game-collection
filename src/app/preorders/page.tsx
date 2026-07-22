import { Suspense } from "react";

import { PreordersPageClient } from "./preorders-page-client";

type PreordersPageProps = {
  searchParams: Promise<{
    itemId?: string;
  }>;
};

export default async function PreordersPage({
  searchParams,
}: PreordersPageProps) {
  const { itemId } = await searchParams;

  return <Suspense><PreordersPageClient initialItemId={itemId} /></Suspense>;
}
