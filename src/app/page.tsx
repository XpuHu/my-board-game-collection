"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Package, PlusCircle, Trophy } from "lucide-react";

import { GameCover } from "@/components/game-cover";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { dashboardRestAdapter } from "@/features/dashboard/api";
import type { DashboardDto } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

export default function HomePage() {
  const query = useAdapterQuery(dashboardRestAdapter, undefined, {
    key: "dashboard",
  });

  return (
    <main className="grid gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            Главная
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Сводка по коллекции, партиям и предзаказам.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new">
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Добавить
          </Link>
        </Button>
      </header>

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? (
        <ErrorState description={query.error} onRetry={query.reload} />
      ) : null}
      {query.data ? <DashboardContent data={query.data} /> : null}
    </main>
  );
}

function DashboardContent({ data }: { data: DashboardDto }) {
  const summary = [
    { label: "Партий", value: data.monthSummary.playsCount },
    { label: "Разных игр", value: data.monthSummary.uniqueItemsCount },
    {
      label: "Наиграно",
      value: `${Math.round(data.monthSummary.totalDurationMinutes / 60)} ч`,
    },
    { label: "Побед", value: data.monthSummary.winsCount },
  ];

  return (
    <>
      <section aria-label="Сводка за месяц" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((entry) => (
          <Panel key={entry.label} className="p-4">
            <p className="text-sm text-muted-foreground">{entry.label}</p>
            <p className="mt-2 text-3xl font-semibold">{entry.value}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Последние партии">
          {data.recentPlays.length ? (
            <div className="grid gap-3">
              {data.recentPlays.map((play) => (
                <Link key={play.id} href={`/collection/${play.item.id}`} className="flex gap-3 rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GameCover src={play.item.cover?.url ?? play.item.cover?.path} alt={play.item.cover?.alt ?? play.item.title} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{play.item.title}</span>
                    <span className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatDate(play.playedAt)}</span>
                      <span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{play.durationMinutes ?? "—"} мин</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Партий пока нет" description="Добавьте первую сыгранную партию." />
          )}
        </Panel>

        <Panel title="Ближайшие предзаказы">
          {data.upcomingPreorders.length ? (
            <div className="grid gap-3">
              {data.upcomingPreorders.map((preorder) => (
                <Link key={preorder.id} href="/preorders" className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Package className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{preorder.item.title}</span>
                    <span className="text-xs text-muted-foreground">{preorder.expectedDate ? formatDate(preorder.expectedDate) : "Дата неизвестна"}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} title="Нет активных предзаказов" description="Новые ожидаемые игры появятся здесь." />
          )}
        </Panel>

        <Panel title="Недавно добавлено">
          {data.recentlyAdded.length ? (
            <div className="grid gap-3">
              {data.recentlyAdded.map((card) => (
                <Link key={card.item.id} href={`/collection/${card.item.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GameCover src={card.item.cover?.url ?? card.item.cover?.path} alt={card.item.cover?.alt ?? card.item.title} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{card.item.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(card.userItem.ownedAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Trophy} title="Коллекция пуста" description="Добавьте первую игру в коллекцию." />
          )}
        </Panel>
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
