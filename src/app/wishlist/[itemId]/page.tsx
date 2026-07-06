import { WishlistItemPageClient } from "./wishlist-item-page-client";

type WishlistItemPageProps = {
  params: Promise<{
    itemId: string;
  }>;
};

export default async function WishlistItemPage({
  params,
}: WishlistItemPageProps) {
  const { itemId } = await params;

  return <WishlistItemPageClient itemId={itemId} />;
}
