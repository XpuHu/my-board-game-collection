"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  ExternalLink,
  Star,
} from "lucide-react";

import { ErrorState, LoadingState } from "@/components/ui-state";
import { ItemReferenceEditor } from "@/components/item-reference-editor";
import { UserItemEditor } from "@/components/user-item-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiClient,
  type CollectionItemDetailsDto,
  type ItemDetailsDto,
  type UserItemDto,
} from "@/shared/api";

type CollectionItemPageClientProps = {
  itemId: string;
};

export function CollectionItemPageClient({
  itemId,
}: CollectionItemPageClientProps) {
  const [details, setDetails] = React.useState<CollectionItemDetailsDto | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.collection.get(itemId);
      setDetails(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить карточку коллекции",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => {
    let isActive = true;

    apiClient.collection
      .get(itemId)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setDetails(response);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить карточку коллекции",
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
  }, [itemId]);

  function applyItemDetailsUpdate(updated: ItemDetailsDto) {
    setDetails((current) =>
      current
        ? {
            ...current,
            ...updated,
            recentPlays: current.recentPlays,
            primaryAction: current.primaryAction,
          }
        : current,
    );
  }

  function applyUserItemUpdate(userItem: UserItemDto) {
    setDetails((current) =>
      current
        ? {
            ...current,
            userItem,
          }
        : current,
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState
          title="Загружаем карточку"
          description="Получаем компактные данные владельца."
        />
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          description={error ?? "Карточка коллекции не найдена"}
          onRetry={loadDetails}
        />
      </main>
    );
  }

  const referenceUrl =
    details.externalReferences.find((reference) => reference.url)?.url ??
    details.links.find((link) => link.type === "official")?.url ??
    null;
  const totalValue = formatPurchases(details.purchases);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/collection">
            <ArrowLeft className="h-4 w-4" />
            Назад к коллекции
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                {details.item.title}
              </h1>
              {details.userItem.owned ? (
                <Badge>Есть</Badge>
              ) : (
                <Badge variant="secondary">Не owned</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{details.item.type.name}</span>
              {details.item.year ? <span>{details.item.year}</span> : null}
              {details.userItem.location ? (
                <span>{details.userItem.location}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/plays?itemId=${encodeURIComponent(itemId)}`}>
                <CalendarPlus className="h-4 w-4" />
                Добавить партию
              </Link>
            </Button>
            {referenceUrl ? (
              <Button asChild variant="outline">
                <a href={referenceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Справочная информация
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <BookOpen className="h-4 w-4" />
                Справочная информация
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Личная оценка"
          value={
            details.userItem.personalRating
              ? `${details.userItem.personalRating}/10`
              : "Нет"
          }
          icon={<Star className="h-4 w-4" />}
        />
        <MetricCard
          label="Последняя партия"
          value={formatDate(details.playSummary.lastPlayedAt)}
        />
        <MetricCard
          label="Всего партий"
          value={String(details.playSummary.playsCount)}
        />
        <MetricCard label="Стоимость" value={totalValue} />
      </section>

      <ItemReferenceEditor
        details={details}
        onDetailsChange={applyItemDetailsUpdate}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Последние партии</h2>
          </div>
          {details.recentPlays.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Партий пока нет.
            </div>
          ) : (
            <div className="divide-y">
              {details.recentPlays.map((play) => (
                <div
                  key={play.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {formatDate(play.playedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {play.playersCount
                        ? `${play.playersCount} игроков`
                        : "Игроки не указаны"}
                      {play.durationMinutes
                        ? `, ${play.durationMinutes} минут`
                        : ""}
                    </div>
                  </div>
                  {play.result ? (
                    <Badge variant="secondary">{play.result}</Badge>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <UserItemEditor
          userItem={details.userItem}
          onUserItemChange={applyUserItemUpdate}
        />
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
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

function formatPurchases(purchases: CollectionItemDetailsDto["purchases"]) {
  if (purchases.length === 0) {
    return "Нет";
  }

  const totals = purchases.reduce<Record<string, number>>(
    (accumulator, item) => {
      accumulator[item.currency] =
        (accumulator[item.currency] ?? 0) + item.totalPrice;
      return accumulator;
    },
    {},
  );

  return Object.entries(totals)
    .map(([currency, amount]) =>
      new Intl.NumberFormat("ru", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount),
    )
    .join(", ");
}
