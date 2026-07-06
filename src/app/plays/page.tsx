import Link from "next/link";
import { CalendarPlus, History } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function PlaysPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Партии</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            История партий и быстрый вход в добавление новой записи.
          </p>
        </div>
        <Button asChild>
          <Link href="/collection">
            <CalendarPlus className="h-4 w-4" />
            Добавить партию
          </Link>
        </Button>
      </div>

      <EmptyState
        icon={History}
        title="История партий пока пуста"
        description="После подключения PlaySession API здесь будет общий список партий и переходы к редактированию записи."
      />
    </main>
  );
}
