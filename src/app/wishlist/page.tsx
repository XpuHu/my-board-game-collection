import Link from "next/link";
import { Search, Star } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function WishlistPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Подробная область для изучения игр перед покупкой.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new">
            <Star className="h-4 w-4" />
            Добавить в wishlist
          </Link>
        </Button>
      </div>

      <EmptyState
        icon={Search}
        title="Wishlist пока пуст"
        description="Здесь появятся подробные карточки игр, внешние ссылки, механики, категории и быстрые действия покупки."
      />
    </main>
  );
}
