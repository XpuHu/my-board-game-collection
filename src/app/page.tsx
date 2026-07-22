"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Camera,
  Clock3,
  Gamepad2,
  Package,
  PlusCircle,
  Search,
  Star,
  Trophy,
} from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { ExpectedDateDialog } from "@/components/expected-date-dialog";
import { GameCover } from "@/components/game-cover";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        title="Главная"
        subtitle="Сводка по коллекции, партиям и предзаказам."
        actions={
          <Button asChild size="icon" variant="outline"><Link href="/collection" aria-label="Поиск по коллекции"><Search className="h-4 w-4" /></Link></Button>
        }
      />

      <Panel title="Быстрые действия">
        <QuickActions onAddPlay={() => setPlayOpen(true)} />
      </Panel>

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
    <div aria-label="Быстрые действия" className="grid gap-3 sm:grid-cols-2">
      <Button type="button" variant="outline" className="h-auto min-w-0 justify-start p-3" onClick={onAddPlay}>
        <CalendarPlus className="h-5 w-5 text-primary" /> Добавить партию
      </Button>
      <Button asChild variant="outline" className="h-auto min-w-0 justify-start p-3">
        <Link href="/items/new"><PlusCircle className="h-5 w-5 text-primary" /> Добавить Item</Link>
      </Button>
      <Button asChild variant="outline" className="h-auto min-w-0 justify-start p-3">
        <Link href="/items/new?target=preorder"><Package className="h-5 w-5 text-primary" /> Оформить предзаказ</Link>
      </Button>
      <Button asChild variant="outline" className="h-auto min-w-0 justify-start p-3">
        <Link href="/collection"><Camera className="h-5 w-5 text-primary" /> Добавить фото</Link>
      </Button>
    </div>
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
    { label: "Наиграно", value: formatDuration(data.monthSummary.totalDurationMinutes) },
    { label: "Средняя оценка", value: data.monthSummary.averagePersonalRating?.toFixed(1) ?? "—" },
    { label: "Побед", value: data.monthSummary.winsCount },
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-12">
        <Panel title="Последние партии" action={<Button asChild size="sm" variant="ghost"><Link href="/plays">Смотреть все</Link></Button>} className="xl:col-span-4">
          {data.recentPlays.length ? (
            <div className="grid gap-2">
              {data.recentPlays.map((play) => (
                <Link key={play.id} href={`/plays?itemId=${encodeURIComponent(play.item.id)}`} className="flex gap-3 rounded-lg p-2 hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GameCover src={play.item.cover?.url ?? play.item.cover?.path} alt={play.item.cover?.alt ?? play.item.title} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{play.item.title}</span>
                    <span className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatDate(play.playedAt)}</span>
                      <span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{play.durationMinutes ? `${play.durationMinutes} мин` : "Без времени"}</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={CalendarDays} title="Партий пока нет" description="Добавьте первую сыгранную партию." />}
        </Panel>

        <Panel title="Ближайшие предзаказы" action={<Button asChild size="sm" variant="ghost"><Link href="/preorders">Смотреть все</Link></Button>} className="xl:col-span-4">
          {data.upcomingPreorders.length ? (
            <div className="grid gap-2">
              {data.upcomingPreorders.map((preorder) => (
                <button key={preorder.id} type="button" onClick={() => onChangeDate(preorder)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GameCover src={preorder.item.cover?.url ?? preorder.item.cover?.path} alt={preorder.item.cover?.alt ?? preorder.item.title} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{preorder.item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{preorder.shop}</span>
                    <span className="mt-1 block text-xs font-medium text-primary">{formatExpectedDate(preorder)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : <EmptyState icon={Package} title="Нет активных предзаказов" description="Новые ожидаемые игры появятся здесь." />}
        </Panel>

        <Panel title="Недавно добавлено" action={<Button asChild size="sm" variant="ghost"><Link href="/collection">Смотреть все</Link></Button>} className="xl:col-span-4">
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

        <Panel title="Статистика за месяц" className="xl:col-span-6">
          <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-5 sm:divide-x">
            {summary.map((entry) => <div key={entry.label} className="px-3 first:pl-0 last:pr-0"><p className="text-2xl font-semibold tabular-nums">{entry.value}</p><p className="mt-1 text-xs text-muted-foreground">{entry.label}</p></div>)}
          </div>
        </Panel>

        <Panel title="Сегодня можно сыграть" className="xl:col-span-3">
          {data.favoriteItem ? <Link href={`/collection/${data.favoriteItem.item.id}`} className="flex gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <GameCover src={data.favoriteItem.item.cover?.url ?? data.favoriteItem.item.cover?.path} alt={data.favoriteItem.item.cover?.alt ?? data.favoriteItem.item.title} size="sm" />
            <span className="min-w-0"><span className="text-xs text-muted-foreground">Любимая игра</span><strong className="mt-1 block truncate">{data.favoriteItem.item.title}</strong><span className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><Star className="h-4 w-4 fill-warning text-warning" />{data.favoriteItem.userItem.personalRating ? `${data.favoriteItem.userItem.personalRating}/10` : "Без оценки"} · {data.favoriteItem.plays.count} партий</span></span>
          </Link> : <EmptyState icon={Gamepad2} title="Выберите любимую игру" description="Отметьте игру звездой в коллекции." />}
        </Panel>

        <Panel title="Активность по дням" className="overflow-hidden xl:col-span-3">
          <ActivityHeatmap activity={data.activity} />
        </Panel>

        <Panel title="Цитата дня" className="flex flex-col justify-between xl:col-span-12">
          <p className="text-lg leading-relaxed">«{quoteForDate()}»</p>
          <p className="mt-6 text-sm text-muted-foreground">Настольный дневник</p>
        </Panel>
    </section>
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function formatExpectedDate(preorder: PreorderListItemDto) {
  if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown") return "Дата неизвестна";
  const date = new Date(preorder.expectedDate);
  if (preorder.expectedDatePrecision === "quarter") return `${Math.floor(date.getUTCMonth() / 3) + 1}-й квартал ${date.getUTCFullYear()}`;
  if (preorder.expectedDatePrecision === "month") return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return formatDate(preorder.expectedDate);
}
