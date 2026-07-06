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

  return <CollectionItemPageClient itemId={itemId} />;
}
