"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clock3,
  ExternalLink,
  Gamepad2,
  Pencil,
  Star,
  Users,
  X,
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

export function CollectionItemPageClient({ itemId }: { itemId: string }) {
  const [details, setDetails] = React.useState<CollectionItemDetailsDto | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetails(await apiClient.collection.get(itemId));
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
        if (isActive) setDetails(response);
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить карточку коллекции",
          );
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
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
    setDetails((current) => (current ? { ...current, userItem } : current));
  }

  if (loading) {
    return (
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState
          title="Загружаем карточку"
          description="Получаем компактные данные владельца."
        />
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          description={error ?? "Карточка коллекции не найдена"}
          onRetry={loadDetails}
        />
      </main>
    );
  }

  const cover = [...details.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((image) => image.url ?? image.path);
  const referenceUrl =
    details.externalReferences.find((reference) => reference.url)?.url ??
    details.links.find((link) => link.type === "official")?.url ??
    null;

  return (
    <main className="flex w-full flex-col gap-5 px-4 pb-10 sm:px-6 lg:px-8">
      <nav
        className="flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="Хлебные крошки"
      >
        <Link href="/collection" className="hover:text-foreground">
          Моя коллекция
        </Link>
        <span>/</span>
        <span className="text-foreground">{details.item.title}</span>
      </nav>

      <div className="flex justify-end">
        <Button
          type="button"
          variant={isEditing ? "secondary" : "outline"}
          onClick={() => setIsEditing((value) => !value)}
        >
          {isEditing ? (
            <X className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
          {isEditing ? "Закончить редактирование" : "Редактировать"}
        </Button>
      </div>

      <section className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        <div className="aspect-square overflow-hidden rounded-xl border bg-card shadow-xl shadow-black/20">
          {cover ? (
            // URLs обложек приходят от разных внешних провайдеров.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url ?? cover.path ?? ""}
              alt={cover.caption ?? `Обложка ${details.item.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <Gamepad2 className="h-16 w-16" />
            </div>
          )}
        </div>

        <div className="min-w-0 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {details.item.title}
            </h1>
            <Badge variant="secondary">{details.item.type.name}</Badge>
          </div>
          {details.item.originalTitle ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {details.item.originalTitle}
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-3">
            <Stars rating={details.item.rating} />
            <span className="font-semibold">{details.item.rating ?? "—"}</span>
          </div>
          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-5 sm:grid-cols-4">
            <Fact
              icon={<Users />}
              label="Игроки"
              value={playerRange(details)}
            />
            <Fact icon={<Clock3 />} label="Минут" value={timeRange(details)} />
            <Fact
              icon={<Users />}
              label="Возраст"
              value={details.item.minAge ? `${details.item.minAge}+` : "—"}
            />
            <Fact
              icon={<Gamepad2 />}
              label="Сложность"
              value={
                details.item.complexity ? `${details.item.complexity}/5` : "—"
              }
            />
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {details.item.mechanics.slice(0, 5).map((mechanic) => (
              <span
                key={mechanic}
                className="rounded-md bg-secondary px-3 py-1.5 text-xs"
              >
                {mechanic}
              </span>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-5">
          <dl className="grid gap-5 text-sm">
            <SummaryRow label="Статус">
              <Badge>
                {details.userItem.owned ? "Есть в коллекции" : "Не в коллекции"}
              </Badge>
            </SummaryRow>
            <SummaryRow label="Место хранения">
              {details.userItem.location ?? "Не указано"}
            </SummaryRow>
            <SummaryRow label="Личная оценка">
              {details.userItem.personalRating
                ? `${details.userItem.personalRating}/10`
                : "Без оценки"}
            </SummaryRow>
          </dl>
          <div className="mt-6 grid gap-3 border-t pt-5">
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
                  Информация об игре
                </a>
              </Button>
            ) : null}
          </div>
        </aside>
      </section>

      {isEditing ? (
        <div className="grid gap-5">
          <ItemReferenceEditor
            details={details}
            onDetailsChange={applyItemDetailsUpdate}
            isEditing
          />
          <UserItemEditor
            userItem={details.userItem}
            onUserItemChange={applyUserItemUpdate}
            isEditing
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.7fr)]">
          <ItemReferenceEditor
            details={details}
            onDetailsChange={applyItemDetailsUpdate}
            isEditing={false}
          />
          <UserItemEditor
            userItem={details.userItem}
            onUserItemChange={applyUserItemUpdate}
            isEditing={false}
          />
        </div>
      )}

      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Последние партии</h2>
          <Link
            href={`/plays?itemId=${encodeURIComponent(itemId)}`}
            className="text-sm text-primary hover:underline"
          >
            Все партии ({details.playSummary.playsCount})
          </Link>
        </div>
        {details.recentPlays.length ? (
          <div className="divide-y">
            {details.recentPlays.map((play) => (
              <div
                key={play.id}
                className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              >
                <span className="font-medium">{formatDate(play.playedAt)}</span>
                <span className="text-muted-foreground">
                  {play.playersCount
                    ? `${play.playersCount} игроков`
                    : "Игроки не указаны"}
                </span>
                <span className="text-muted-foreground">
                  {play.durationMinutes ? `${play.durationMinutes} мин` : "—"}
                </span>
                {play.result ? (
                  <Badge variant="secondary">{play.result}</Badge>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Партий пока нет.
          </p>
        )}
      </section>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      {React.cloneElement(icon, { className: "h-5 w-5 text-primary" })}
      <div>
        <div className="font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function Stars({ rating }: { rating?: number | null }) {
  const filled = rating ? Math.round(rating / 2) : 0;
  return (
    <div
      className="flex gap-0.5"
      aria-label={rating ? `Рейтинг ${rating} из 10` : "Нет рейтинга"}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-5 w-5 ${index < filled ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

function playerRange(details: CollectionItemDetailsDto) {
  const { minPlayers, maxPlayers } = details.item;
  if (!minPlayers && !maxPlayers) return "—";
  return minPlayers === maxPlayers
    ? String(minPlayers ?? maxPlayers)
    : `${minPlayers ?? "?"}–${maxPlayers ?? "?"}`;
}

function timeRange(details: CollectionItemDetailsDto) {
  const { minPlayTime, maxPlayTime } = details.item;
  if (!minPlayTime && !maxPlayTime) return "—";
  return minPlayTime === maxPlayTime
    ? String(minPlayTime ?? maxPlayTime)
    : `${minPlayTime ?? "?"}–${maxPlayTime ?? "?"}`;
}

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("ru", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Не было";
}
