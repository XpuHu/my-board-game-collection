"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Camera,
  Clock3,
  Package,
  PlusCircle,
  Trophy,
} from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { ExpectedDateDialog } from "@/components/expected-date-dialog";
import { GameCover } from "@/components/game-cover";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { dashboardRestAdapter } from "@/features/dashboard/api";
import { quoteForDate } from "@/features/dashboard/content";
import type { DashboardDto, PreorderListItemDto } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

export default function HomePage() {
  const query = useAdapterQuery(dashboardRestAdapter, undefined, {
    key: "dashboard",
  });
  const [playOpen, setPlayOpen] = React.useState(false);
  const [datePreorder, setDatePreorder] =
    React.useState<PreorderListItemDto | null>(null);

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
            Добавить Item
          </Link>
        </Button>
      </header>

      <QuickActions onAddPlay={() => setPlayOpen(true)} />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? (
        <ErrorState description={query.error} onRetry={query.reload} />
      ) : null}
      {query.data ? (
        <DashboardContent
          data={query.data}
          onChangeDate={setDatePreorder}
        />
      ) : null}

      {playOpen ? <AddPlayDialog
        open={playOpen}
        onOpenChange={setPlayOpen}
        onSaved={query.reload}
      /> : null}
      {datePreorder ? <ExpectedDateDialog
        preorder={datePreorder}
        open={Boolean(datePreorder)}
        onOpenChange={(open) => {
          if (!open) setDatePreorder(null);
        }}
        onSaved={query.reload}
      /> : null}
    </main>
  );
}

function QuickActions({ onAddPlay }: { onAddPlay: () => void }) {
  return (
    <section aria-label="Быстрые действия" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Button type="button" variant="outline" className="h-auto justify-start p-4" onClick={onAddPlay}>
        <CalendarPlus className="h-5 w-5 text-primary" /> Добавить партию
      </Button>
      <Button asChild variant="outline" className="h-auto justify-start p-4">
        <Link href="/items/new"><PlusCircle className="h-5 w-5 text-primary" /> Добавить Item</Link>
      </Button>
      <Button asChild variant="outline" className="h-auto justify-start p-4">
        <Link href="/items/new?target=preorder"><Package className="h-5 w-5 text-primary" /> Оформить предзаказ</Link>
      </Button>
      <Button asChild variant="outline" className="h-auto justify-start p-4">
        <Link href="/collection"><Camera className="h-5 w-5 text-primary" /> Добавить фото</Link>
      </Button>
    </section>
  );
}

function DashboardContent({
  data,
  onChangeDate,
}: {
  data: DashboardDto;
  onChangeDate: (preorder: PreorderListItemDto) => void;
}) {
  const summary = [
    { label: "Партий", value: data.monthSummary.playsCount },
    { label: "Разных игр", value: data.monthSummary.uniqueItemsCount },
    { label: "Наиграно", value: `${Math.round(data.monthSummary.totalDurationMinutes / 60)} ч` },
    { label: "Побед", value: data.monthSummary.winsCount },
  ];

  return (
    <>
      <section aria-label="Сводка за месяц" className="grid grid-cols-2 gap-3 xl:grid-cols-12">
        {summary.map((entry) => (
          <Panel key={entry.label} className="p-4 xl:col-span-3">
            <p className="text-sm text-muted-foreground">{entry.label}</p>
            <p className="mt-2 text-3xl font-semibold">{entry.value}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <Panel title="Последние партии" className="xl:col-span-5">
          {data.recentPlays.length ? (
            <div className="grid gap-2">
              {data.recentPlays.map((play) => (
                <Link key={play.id} href={`/collection/${play.item.id}?tab=plays`} className="flex gap-3 rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
          ) : <EmptyState icon={CalendarDays} title="Партий пока нет" description="Добавьте первую сыгранную партию." />}
        </Panel>

        <Panel title="Ближайшие предзаказы" className="xl:col-span-3">
          {data.upcomingPreorders.length ? (
            <div className="grid gap-2">
              {data.upcomingPreorders.map((preorder) => (
                <button key={preorder.id} type="button" onClick={() => onChangeDate(preorder)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Package className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{preorder.item.title}</span>
                    <span className="text-xs text-muted-foreground">{formatExpectedDate(preorder)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : <EmptyState icon={Package} title="Нет активных предзаказов" description="Новые ожидаемые игры появятся здесь." />}
        </Panel>

        <Panel title="Недавно добавлено" className="xl:col-span-4">
          {data.recentlyAdded.length ? (
            <div className="grid grid-cols-2 gap-3">
              {data.recentlyAdded.map((card) => (
                <Link key={card.item.id} href={`/collection/${card.item.id}`} className="rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GameCover src={card.item.cover?.url ?? card.item.cover?.path} alt={card.item.cover?.alt ?? card.item.title} size="card" className="w-full" />
                  <span className="mt-2 block truncate text-sm font-medium">{card.item.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(card.userItem.ownedAt)}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={Trophy} title="Коллекция пуста" description="Добавьте первую игру в коллекцию." />}
        </Panel>

        <Panel title="Активность за год" className="overflow-hidden xl:col-span-8">
          <ActivityHeatmap activity={data.activity} />
        </Panel>
        <Panel className="flex flex-col justify-between xl:col-span-4">
          <p className="text-lg leading-relaxed">«{quoteForDate()}»</p>
          <p className="mt-6 text-sm text-muted-foreground">Настольный дневник</p>
        </Panel>
      </section>
    </>
  );
}

function ActivityHeatmap({ activity }: { activity: DashboardDto["activity"] }) {
  const counts = new Map(activity.map(({ date, playsCount }) => [date, playsCount]));
  const days = Array.from({ length: 112 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (111 - index));
    const key = localDateKey(date);
    return { key, count: counts.get(key) ?? 0 };
  });
  return (
    <div className="grid auto-cols-fr grid-flow-col grid-rows-7 gap-1" aria-label="Календарь активности">
      {days.map(({ key, count }) => (
        <span key={key} title={`${key}: ${count} партий`} aria-label={`${key}: ${count} партий`} className={`aspect-square min-w-1 rounded-sm ${heatClass(count)}`} />
      ))}
    </div>
  );
}

function heatClass(count: number) {
  if (count >= 4) return "bg-primary";
  if (count >= 2) return "bg-primary/70";
  if (count >= 1) return "bg-primary/40";
  return "bg-muted";
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatExpectedDate(preorder: PreorderListItemDto) {
  if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown") return "Дата неизвестна";
  const date = new Date(preorder.expectedDate);
  if (preorder.expectedDatePrecision === "quarter") return `${Math.floor(date.getUTCMonth() / 3) + 1}-й квартал ${date.getUTCFullYear()}`;
  if (preorder.expectedDatePrecision === "month") return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return formatDate(preorder.expectedDate);
}
