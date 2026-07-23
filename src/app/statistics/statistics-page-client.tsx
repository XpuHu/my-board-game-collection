"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Dice5,
  History,
  RotateCcw,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/panel";
import { statisticsRestAdapter } from "@/features/statistics/api";
import type {
  ItemListDto,
  PlaySessionDto,
  StatisticsOverviewDto,
  StatisticsQueryDto,
} from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const periods: {
  value: NonNullable<StatisticsQueryDto["period"]>;
  label: string;
}[] = [
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
  { value: "all", label: "Всё время" },
  { value: "custom", label: "Период" },
];

export function StatisticsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = React.useMemo(
    () => statisticsQueryFromUrl(searchParams),
    [searchParams],
  );
  const result = useAdapterQuery(statisticsRestAdapter, query);

  function setPeriod(period: NonNullable<StatisticsQueryDto["period"]>) {
    const next = new URLSearchParams(searchParams.toString());
    if (period === "month") next.delete("period");
    else next.set("period", period);
    if (period === "custom") {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 30);
      next.set("from", dateInputValue(from));
      next.set("to", dateInputValue(to));
    } else {
      next.delete("from");
      next.delete("to");
    }
    router.push(statisticsHref(next));
  }

  function applyCustomPeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", "custom");
    next.set("from", String(form.get("from") ?? ""));
    next.set("to", String(form.get("to") ?? ""));
    router.push(statisticsHref(next));
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Статистика</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Активность, результаты, партнёры и использование дополнений.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={result.reload}>
          <RotateCcw className="h-4 w-4" />
          Обновить
        </Button>
      </header>

      <section aria-label="Период статистики" className="flex flex-wrap gap-2">
        {periods.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={query.period === value ? "default" : "outline"}
            aria-pressed={query.period === value}
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </section>

      {query.period === "custom" ? (
        <form
          key={searchParams.toString()}
          onSubmit={applyCustomPeriod}
          className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <Label htmlFor="statistics-from">С даты</Label>
            <Input
              id="statistics-from"
              name="from"
              type="date"
              required
              defaultValue={query.from}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="statistics-to">По дату</Label>
            <Input
              id="statistics-to"
              name="to"
              type="date"
              required
              defaultValue={query.to}
              className="mt-2"
            />
          </div>
          <Button type="submit">Применить</Button>
        </form>
      ) : null}

      {result.isLoading ? (
        <LoadingState
          title="Считаем статистику"
          description="Собираем партии и агрегаты выбранного периода."
        />
      ) : result.error ? (
        <ErrorState description={result.error} onRetry={result.reload} />
      ) : !result.data || result.data.playsTotal === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="В выбранном периоде нет партий"
          description="Выберите другой период или добавьте первую партию."
          action={
            <Button asChild>
              <Link href="/plays">
                <Dice5 className="h-4 w-4" />
                Добавить партию
              </Link>
            </Button>
          }
        />
      ) : (
        <StatisticsContent data={result.data} />
      )}
    </main>
  );
}

function StatisticsContent({ data }: { data: StatisticsOverviewDto }) {
  const popularItem = data.mostPlayedItems[0];
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric
          label="Всего партий"
          value={String(data.playsTotal)}
          icon={<Dice5 className="h-4 w-4" />}
        />
        <Metric
          label="Уникальных игр"
          value={String(data.uniquePlayedItems)}
          icon={<History className="h-4 w-4" />}
        />
        <Metric
          label="Часов за столом"
          value={formatNumber(data.totalPlayHours)}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <Metric
          label="Средняя оценка"
          value={
            data.averagePersonalRating
              ? `${formatNumber(data.averagePersonalRating)}/10`
              : "—"
          }
          icon={<Star className="h-4 w-4" />}
        />
        <Metric
          label="Победы"
          value={
            data.winRate === null || data.winRate === undefined
              ? "—"
              : `${formatNumber(data.winRate)}%`
          }
          icon={<Trophy className="h-4 w-4" />}
        />
        <Metric
          label="Популярная игра"
          value={popularItem?.item.title ?? "—"}
          icon={<BarChart3 className="h-4 w-4" />}
          compact
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarPanel
          title="Партии по месяцам"
          rows={data.playsByMonth.map((entry) => ({
            label: formatMonth(entry.month),
            value: entry.playsCount,
          }))}
        />
        <TopGames items={data.mostPlayedItems} />
        <BarPanel
          title="Распределение по количеству игроков"
          rows={data.playerCountDistribution.map((entry) => ({
            label: `${entry.playersCount} игроков`,
            value: entry.playsCount,
          }))}
        />
        <BarPanel
          title="Победы и поражения"
          rows={data.results.map((entry) => ({
            label: resultLabel(entry.result),
            value: entry.playsCount,
          }))}
        />
        <BarPanel
          title="Активность по дням недели"
          rows={data.activityByWeekday.map((entry) => ({
            label: weekdayLabel(entry.weekday),
            value: entry.playsCount,
          }))}
        />
        <LatestPlays plays={data.latestPlays} />
        <CollectionList
          title="Давно не играли"
          items={data.staleItems.map((entry) => ({
              id: entry.item.id,
              title: entry.item.title,
              value: entry.plays.lastPlayedAt
                ? formatDate(entry.plays.lastPlayedAt)
              : "Партий ещё не было",
          }))}
        />
        <SimpleList
          title="Использование дополнений"
          rows={data.expansionUsage.map((entry) => ({
            id: entry.itemId,
            label: entry.title,
            value: `${entry.playsCount} партий`,
          }))}
        />
        <SimpleList
          title="Частые партнёры"
          rows={data.frequentPlayers.map((entry) => ({
            id: entry.name,
            label: entry.name,
            value: `${entry.playsCount} партий`,
          }))}
          icon={<Users className="h-4 w-4" />}
        />
        <Panel title="Средняя длительность">
          <div className="flex min-h-40 items-center justify-center">
            <span className="text-4xl font-semibold">
              {data.averagePlayDurationMinutes
                ? `${data.averagePlayDurationMinutes} мин`
                : "—"}
            </span>
          </div>
        </Panel>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={
          compact
            ? "mt-2 line-clamp-2 text-lg font-semibold"
            : "mt-2 text-2xl font-semibold"
        }
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function BarPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Panel title={title}>
      {rows.length ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(5.5rem,auto)_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span
                className="truncate text-muted-foreground"
                title={row.label}
              >
                {row.label}
              </span>
              <div
                className="h-3 overflow-hidden rounded-full bg-secondary"
                role="img"
                aria-label={`${row.label}: ${row.value}`}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
              <strong className="text-right">{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Нет данных.</p>
      )}
    </Panel>
  );
}

function TopGames({ items }: { items: ItemListDto[] }) {
  return (
    <Panel title="Топ игр">
      <div className="grid gap-2">
        {items.map((entry, index) => (
          <Link
            key={entry.item.id}
            href={`/collection/${entry.item.id}`}
            className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-5 text-center font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.item.title}</span>
            <Badge>{entry.playsCount}</Badge>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function LatestPlays({ plays }: { plays: PlaySessionDto[] }) {
  return (
    <Panel title="История партий">
      <div className="divide-y">
        {plays.map((play) => (
          <div
            key={play.id}
            className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="min-w-0">
              <Link
                href={`/plays?itemId=${play.itemId}`}
                className="block truncate font-medium hover:underline"
              >
                {play.itemTitle}
              </Link>
              <span className="text-xs text-muted-foreground">
                {formatDate(play.playedAt)}
              </span>
            </span>
            {play.personalRating ? (
              <Badge variant="secondary">{play.personalRating}/10</Badge>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CollectionList({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; value: string }[];
}) {
  return (
    <SimpleList
      title={title}
      rows={items.map((item) => ({
        id: item.id,
        label: item.title,
        value: item.value,
        href: `/collection/${item.id}`,
      }))}
    />
  );
}

function SimpleList({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: { id: string; label: string; value: string; href?: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <Panel title={title}>
      {rows.length ? (
        <div className="divide-y">
          {rows.map((row) => {
            const content = (
              <>
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.value}
                </span>
              </>
            );
            return row.href ? (
              <Link
                key={row.id}
                href={row.href}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </Link>
            ) : (
              <div
                key={row.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                {icon}
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Нет данных.</p>
      )}
    </Panel>
  );
}

export function statisticsQueryFromUrl(
  searchParams: URLSearchParams,
): StatisticsQueryDto {
  return {
    period:
      (searchParams.get("period") as StatisticsQueryDto["period"]) ?? "month",
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  };
}

function statisticsHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/statistics?${query}` : "/statistics";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "2-digit",
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function weekdayLabel(index: number) {
  return ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][index] ?? String(index);
}

function resultLabel(result: string) {
  if (result === "win") return "Победы";
  if (result === "loss") return "Поражения";
  if (result === "score") return "По счёту";
  return "Не указано";
}

function dateInputValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
