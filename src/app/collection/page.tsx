import Link from "next/link";
import { ListPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function CollectionPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Коллекция</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Компактный список owned Item для быстрых ежедневных действий.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new">
            <ListPlus className="h-4 w-4" />
            Добавить игру
          </Link>
        </Button>
      </div>

      <EmptyState
        icon={Search}
        title="Коллекция пока пуста"
        description="После подключения списка здесь будут название, личная оценка, количество партий и последняя партия без длинных описаний."
      />
    </main>
  );
}
