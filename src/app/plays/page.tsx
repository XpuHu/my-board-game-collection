import { PlaysPageClient } from "./plays-page-client";

type PlaysPageProps = {
  searchParams: Promise<{
    itemId?: string;
  }>;
};

export default async function PlaysPage({ searchParams }: PlaysPageProps) {
  const { itemId } = await searchParams;

  return <PlaysPageClient initialItemId={itemId} />;
}
