"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Coins,
  Dice5,
  ListOrdered,
  RotateCcw,
  Star,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiClient,
  type ItemListDto,
  type MoneyAmountDto,
  type PlaySessionDto,
  type StatisticsSummaryDto,
} from "@/shared/api";

export function StatisticsPageClient() {
  const [summary, setSummary] = React.useState<StatisticsSummaryDto | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSummary(await apiClient.statistics.summary());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить статистику",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isActive = true;

    apiClient.statistics
      .summary()
      .then((response) => {
        if (!isActive) {
          return;
        }

        setSummary(response);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить статистику",
        );
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Статистика
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            История партий, активность по годам и стоимость коллекции.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadSummary}>
          <RotateCcw className="h-4 w-4" />
          Обновить
        </Button>
      </div>

      {loading ? (
        <LoadingState
          title="Считаем статистику"
          description="Собираем партии, коллекцию, wishlist и предзаказы."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={loadSummary} />
      ) : !summary || summary.playsTotal === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Статистика пока пустая"
          description="Добавленные партии появятся здесь в истории, топах и годовой динамике."
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
        <StatisticsContent summary={summary} />
      )}
    </main>
  );
}

function StatisticsContent({ summary }: { summary: StatisticsSummaryDto }) {
  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего партий"
          value={String(summary.playsTotal)}
          icon={<Dice5 className="h-4 w-4" />}
        />
        <MetricCard
          label="За месяц"
          value={String(summary.playsThisMonth)}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <MetricCard
          label="Средняя длительность"
          value={
            summary.averagePlayDurationMinutes
              ? `${summary.averagePlayDurationMinutes} мин`
              : "Нет"
          }
          icon={<Clock3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Размеры"
          value={`${summary.itemsTotal} / ${summary.wishlistTotal}`}
          hint="Коллекция / wishlist"
          icon={<ListOrdered className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <LatestPlays plays={summary.latestPlays} />
        <FavoriteItem item={summary.favoriteItem} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <TopGames items={summary.mostPlayedItems} />
        <YearlyChart data={summary.playCountByYear} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <MoneySection
          title="Стоимость коллекции"
          values={summary.collectionValue}
        />
        <MoneySection title="Активные предзаказы" values={summary.preorderValue} />
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function LatestPlays({ plays }: { plays: PlaySessionDto[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Последние партии</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/plays">Открыть все</Link>
        </Button>
      </div>
      <div className="divide-y">
        {plays.map((play) => (
          <article
            key={play.id}
            className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="min-w-0">
              <Link
                href={`/plays?itemId=${encodeURIComponent(play.itemId)}`}
                className="font-medium hover:underline"
              >
                {play.itemTitle}
              </Link>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDate(play.playedAt)}
                {play.playersCount ? `, ${play.playersCount} игроков` : ""}
                {play.durationMinutes ? `, ${play.durationMinutes} мин` : ""}
              </div>
            </div>
            {play.source === "boardgamegeek" ? (
              <Badge variant="secondary">BGG</Badge>
            ) : (
              <Badge variant="outline">manual</Badge>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function FavoriteItem({ item }: { item?: ItemListDto | null }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Любимая игра</h2>
      </div>
      {item ? (
        <div className="grid gap-4 p-4">
          <div>
            <Link
              href={`/collection/${item.item.id}`}
              className="text-lg font-semibold hover:underline"
            >
              {item.item.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.userItem.personalRating ? (
                <Badge>
                  <Star className="mr-1 h-3 w-3" />
                  {item.userItem.personalRating}/10
                </Badge>
              ) : null}
              <Badge variant="secondary">{item.playsCount} партий</Badge>
              {item.item.year ? (
                <Badge variant="outline">{item.item.year}</Badge>
              ) : null}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Последняя партия: {formatDate(item.lastPlayedAt)}
          </div>
        </div>
      ) : (
        <div className="p-4 text-sm text-muted-foreground">
          Нет игр с партиями или оценкой.
        </div>
      )}
    </section>
  );
}

function TopGames({ items }: { items: ItemListDto[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Топ игр по партиям</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          Партий по играм пока нет.
        </div>
      ) : (
        <div className="divide-y">
          {items.map((entry, index) => (
            <article
              key={entry.item.id}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
            >
              <div className="text-lg font-semibold text-muted-foreground">
                {index + 1}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/collection/${entry.item.id}`}
                  className="font-medium hover:underline"
                >
                  {entry.item.title}
                </Link>
                <div className="mt-1 text-sm text-muted-foreground">
                  Последняя партия: {formatDate(entry.lastPlayedAt)}
                </div>
              </div>
              <Badge>{entry.playsCount}</Badge>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function YearlyChart({
  data,
}: {
  data: StatisticsSummaryDto["playCountByYear"];
}) {
  const maxCount = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Партии по годам</h2>
      </div>
      {data.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">Нет данных.</div>
      ) : (
        <div className="grid gap-3 p-4">
          {data.map((entry) => (
            <div key={entry.year} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
              <div className="text-sm text-muted-foreground">{entry.year}</div>
              <div className="h-3 overflow-hidden rounded-md bg-secondary">
                <div
                  className="h-full rounded-md bg-primary"
                  style={{ width: `${(entry.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="text-right text-sm font-medium">{entry.count}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MoneySection({
  title,
  values,
}: {
  title: string;
  values: MoneyAmountDto[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Coins className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {values.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">Нет данных.</div>
      ) : (
        <div className="grid gap-2 p-4">
          {values.map((value) => (
            <div
              key={value.currency}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">
                {value.currency}
              </span>
              <span className="font-semibold">
                {formatMoney(value.amount, value.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Не было";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ru", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
