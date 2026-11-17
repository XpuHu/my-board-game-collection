"use client";
import { Dropdown } from "@/components/ui/dropdown";
import { useProductFeatures } from "@/components/product-features-provider";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  CalendarPlus,
  Clock3,
  ImageIcon,
  ListPlus,
  Plus,
  Search,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { EmptyState, ErrorState } from "@/components/ui-state";
import { GameCover } from "@/components/game-cover";
import { OverflowMenu, OverflowMenuItem } from "@/components/overflow-menu";
import { Pagination } from "@/components/pagination";
import { Rating } from "@/components/rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast-provider";
import {
  collectionRestAdapter,
  updateCollectionFavorite,
  type CollectionListQuery,
} from "@/features/collection/api";
import type { CollectionCardDto, ItemTypeCode, PlayResult } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";
import { cn } from "@/shared/lib/utils";

import styles from "./collection-page.module.css";

type CollectionTabType = "base_game" | "expansion" | "accessory";

const typeTabs: { label: string; value?: CollectionTabType }[] = [
  { label: "Все" },
  { label: "Игры", value: "base_game" },
  { label: "Дополнения", value: "expansion" },
  { label: "Аксессуары", value: "accessory" },
];

const sortOptions = [
  { value: "lastPlayed:desc", label: "Недавние партии" },
  { value: "lastPlayed:asc", label: "Давно не играли" },
  { value: "plays:desc", label: "Количество партий" },
  { value: "rating:desc", label: "Личная оценка" },
  { value: "title:asc", label: "Название" },
] as const;

export function CollectionPageClient() {
  const features = useProductFeatures();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = React.useMemo(() => {
    const parsed = collectionQueryFromUrl(searchParams);
    return features.plays
      ? parsed
      : {
          ...parsed,
          sort:
            parsed.sort === "plays" ||
            parsed.sort === "lastPlayed" ||
            !searchParams.has("sort")
              ? ("title" as const)
              : parsed.sort,
          direction: !searchParams.has("sort")
            ? ("asc" as const)
            : parsed.direction,
        };
  }, [searchParams, features.plays]);
  const result = useAdapterQuery(collectionRestAdapter, query);
  const counts = {
    all: useCollectionCount(query.q, undefined, query.favorite),
    base_game: useCollectionCount(query.q, "base_game", query.favorite),
    expansion: useCollectionCount(query.q, "expansion", query.favorite),
    accessory: useCollectionCount(query.q, "accessory", query.favorite),
  };
  const [playCard, setPlayCard] = React.useState<CollectionCardDto | null>(
    null,
  );
  const [favoriteOverrides, setFavoriteOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [favoriteSaving, setFavoriteSaving] = React.useState<Set<string>>(
    () => new Set(),
  );

  async function toggleFavorite(card: CollectionCardDto) {
    const itemId = card.item.id;
    const current = favoriteOverrides[itemId] ?? card.userItem.favorite;
    const next = !current;
    setFavoriteOverrides((values) => ({ ...values, [itemId]: next }));
    setFavoriteSaving((values) => new Set(values).add(itemId));
    try {
      await updateCollectionFavorite(itemId, next);
      toast({
        title: next ? "Добавлено в избранное" : "Удалено из избранного",
        variant: "success",
      });
      result.reload();
    } catch (error) {
      setFavoriteOverrides((values) => {
        const copy = { ...values };
        delete copy[itemId];
        return copy;
      });
      toast({
        title: "Не удалось изменить избранное",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setFavoriteSaving((values) => {
        const copy = new Set(values);
        copy.delete(itemId);
        return copy;
      });
    }
  }

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams.toString());
    setOrDelete(next, "q", String(form.get("q") ?? "").trim());
    next.delete("page");
    router.push(collectionHref(next));
  }

  function changeSort(value: string) {
    const [sort, direction] = value.split(":");
    const next = new URLSearchParams(searchParams.toString());
    setOrDelete(next, "sort", sort);
    setOrDelete(next, "direction", direction === "asc" ? "asc" : "");
    next.delete("page");
    router.push(collectionHref(next));
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Моя коллекция</h1>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.data
          ? `Найдено: ${result.data.pagination.total}`
          : "Загрузка коллекции…"}
      </p>
      <div className={styles.toolbar}>
        <form
          key={query.q ?? ""}
          className={styles.searchForm}
          onSubmit={applySearch}
          role="search"
        >
          <Search aria-hidden="true" className={styles.searchIcon} />
          <Input
            aria-label="Поиск по коллекции"
            className={styles.searchInput}
            defaultValue={query.q ?? ""}
            name="q"
            placeholder="Поиск по коллекции..."
          />
          <Button type="submit" variant="outline">
            Найти
          </Button>
        </form>

        <nav aria-label="Тип предмета" className={styles.tabs}>
          {typeTabs.map((tab) => {
            const active = (query.type ?? undefined) === tab.value;
            const next = new URLSearchParams(searchParams.toString());
            setOrDelete(next, "type", tab.value ?? "");
            next.delete("page");
            const count =
              counts[tab.value ?? "all"].data?.pagination.total ?? null;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(styles.tab, active && styles.tabActive)}
                href={collectionHref(next)}
                key={tab.label}
              >
                <span>{tab.label}</span>
                <span className={styles.tabCount}>{count ?? "…"}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <Button
            variant={query.favorite ? "default" : "outline"}
            aria-pressed={Boolean(query.favorite)}
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              setOrDelete(next, "favorite", query.favorite ? "" : "true");
              next.delete("page");
              router.push(collectionHref(next));
            }}
          >
            Избранное
          </Button>
          {query.q ||
          query.type ||
          query.favorite ||
          query.hasActivePreorder ||
          query.hasExpansions ? (
            <Button asChild variant="outline">
              <Link href="/collection">Сбросить фильтры</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/collection/import">Импорт BGG</Link>
          </Button>
          <label className={styles.sortControl}>
            <span className={styles.sortLabel}>Сортировка:</span>
            <span className={styles.selectWrap}>
              <Dropdown
                aria-label="Сортировка"
                className={styles.sortSelect}
                onValueChange={changeSort}
                value={sortSelection(query)}
              >
                {sortOptions
                  .filter(
                    (option) =>
                      features.plays ||
                      (!option.value.startsWith("plays") &&
                        !option.value.startsWith("lastPlayed")),
                  )
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </Dropdown>
            </span>
          </label>

          <Button asChild className={styles.addButton}>
            <Link href="/items/new?target=collection">
              <ListPlus aria-hidden="true" />
              <span>Добавить игру</span>
            </Link>
          </Button>
        </div>
      </div>

      {result.isLoading ? <CollectionLoading /> : null}
      {result.error ? (
        <ErrorState description={result.error} onRetry={result.reload} />
      ) : null}
      {result.data && result.data.data.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/items/new?target=collection">Добавить игру</Link>
            </Button>
          }
          description="Измените поиск или добавьте первую игру в коллекцию."
          icon={Boxes}
          title="Ничего не найдено"
        />
      ) : null}

      {result.data?.data.length ? (
        <>
          <section
            aria-label="Игры в коллекции"
            className={styles.collectionGrid}
          >
            {result.data.data.map((card) => {
              const favorite =
                favoriteOverrides[card.item.id] ?? card.userItem.favorite;
              const displayCard = {
                ...card,
                userItem: { ...card.userItem, favorite },
              };

              return (
                <CollectionCard
                  card={displayCard}
                  favoriteSaving={favoriteSaving.has(card.item.id)}
                  key={card.item.id}
                  onAddPlay={() => setPlayCard(displayCard)}
                  onToggleFavorite={() => toggleFavorite(displayCard)}
                />
              );
            })}
            <AddGameCard />
          </section>

          <Pagination
            createHref={(page) => {
              const next = new URLSearchParams(searchParams.toString());
              if (page <= 1) next.delete("page");
              else next.set("page", String(page));
              return collectionHref(next);
            }}
            page={result.data.pagination.page}
            totalPages={result.data.pagination.totalPages}
          />
        </>
      ) : null}

      {features.plays && playCard ? (
        <AddPlayDialog
          initialItemId={playCard.item.id}
          initialItemTitle={playCard.item.title}
          onOpenChange={(open) => {
            if (!open) setPlayCard(null);
          }}
          onSaved={result.reload}
          open={Boolean(playCard)}
        />
      ) : null}
    </main>
  );
}

function CollectionCard({
  card,
  favoriteSaving,
  onToggleFavorite,
  onAddPlay,
}: {
  card: CollectionCardDto;
  favoriteSaving: boolean;
  onToggleFavorite: () => void;
  onAddPlay: () => void;
}) {
  const features = useProductFeatures();
  const activity = playActivity(card.plays.lastPlayedAt);
  const result = playResult(card.plays.lastResult);
  const rating =
    card.userItem.personalRating != null
      ? card.userItem.personalRating / 2
      : card.item.communityRating != null
        ? card.item.communityRating / 2
        : null;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <GameCover
          alt={card.item.cover?.alt ?? card.item.title}
          className={styles.cover}
          size="fill"
          src={card.item.cover?.url ?? card.item.cover?.path}
        />
        <div aria-hidden="true" className={styles.mediaShade} />

        <Link
          aria-label={`Открыть ${card.item.title}`}
          className={styles.cardLink}
          href={`${features.mode === "mvp" ? "/items" : "/collection"}/${card.item.id}`}
        >
          <div className={styles.cardTop}>
            <h2>{card.item.title}</h2>
            <Rating className={styles.rating} value={rating} />
            {features.plays ? (
              <span
                className={cn(
                  styles.activityBadge,
                  styles[`activity-${activity.tone}`],
                )}
              >
                {activity.label}
              </span>
            ) : (
              <span>{card.item.type.name}</span>
            )}
          </div>

          {features.plays ? (
            <div className={styles.cardStats}>
              <strong>{card.plays.count}</strong>
              <span>
                {plural(card.plays.count, "партия", "партии", "партий")}
              </span>
              <div className={styles.playMeta}>
                <span>
                  <Users aria-hidden="true" />
                  {playersLabel(card)}
                </span>
                <span>
                  <Clock3 aria-hidden="true" />
                  {durationLabel(card)}
                </span>
                <span
                  className={cn(
                    result.tone === "success" && styles.resultSuccess,
                    result.tone === "danger" && styles.resultDanger,
                  )}
                >
                  <Trophy aria-hidden="true" />
                  {result.label}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs">
              {card.userItem.personalRating != null
                ? "Моя оценка"
                : "Рейтинг источника"}
            </span>
          )}
        </Link>

        {features.plays ? (
          <button
            aria-label={`Добавить партию в ${card.item.title}`}
            className={styles.quickPlay}
            onClick={onAddPlay}
            title="Добавить партию"
            type="button"
          >
            <Plus aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <footer className={styles.cardFooter}>
        <span>
          {card.expansionsCount > 0 ? card.expansionsCount : "—"}{" "}
          {plural(
            card.expansionsCount,
            "дополнение",
            "дополнения",
            "дополнений",
          )}
        </span>
        <span>
          <ImageIcon aria-hidden="true" />
          {card.imagesCount} фото
        </span>
        <OverflowMenu className={styles.cardMenu}>
          <OverflowMenuItem
            disabled={favoriteSaving}
            onClick={onToggleFavorite}
          >
            <Star
              aria-hidden="true"
              fill={card.userItem.favorite ? "currentColor" : "none"}
            />
            {card.userItem.favorite
              ? "Убрать из избранного"
              : "Добавить в избранное"}
          </OverflowMenuItem>
          {features.plays ? (
            <OverflowMenuItem onClick={onAddPlay}>
              <CalendarPlus aria-hidden="true" />
              Добавить партию
            </OverflowMenuItem>
          ) : null}
        </OverflowMenu>
      </footer>
    </article>
  );
}

function AddGameCard() {
  return (
    <Link
      aria-label="Добавить игру в коллекцию"
      className={styles.addGameCard}
      href="/items/new?target=collection"
    >
      <span className={styles.addGameIcon}>
        <Plus aria-hidden="true" />
      </span>
      <span>Добавить игру</span>
    </Link>
  );
}

function CollectionLoading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={styles.collectionGrid}
    >
      <span className="sr-only">Загружаем данные</span>
      {Array.from({ length: 8 }, (_, index) => (
        <div className={styles.loadingCard} key={index}>
          <div />
          <span />
        </div>
      ))}
    </section>
  );
}

function useCollectionCount(
  q?: string,
  type?: CollectionTabType,
  favorite?: boolean,
) {
  return useAdapterQuery(
    collectionRestAdapter,
    {
      q,
      type,
      favorite,
      page: 1,
      pageSize: 24,
      sort: "title",
      direction: "asc",
    },
    { key: `collection-count:${q ?? ""}:${type ?? "all"}:${favorite ?? ""}` },
  );
}

function playActivity(lastPlayedAt?: string | null): {
  label: string;
  tone: "recent" | "warning" | "neutral";
} {
  if (!lastPlayedAt) return { label: "Ещё не играли", tone: "neutral" };
  const timestamp = new Date(lastPlayedAt).getTime();
  const days = Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
    : 0;

  if (days === 0) return { label: "Играли сегодня", tone: "recent" };
  if (days === 1) return { label: "Играли вчера", tone: "recent" };
  if (days < 7) {
    return {
      label: `${days} ${plural(days, "день", "дня", "дней")} назад`,
      tone: "warning",
    };
  }
  if (days < 28) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return {
      label: `${weeks} ${plural(weeks, "неделю", "недели", "недель")} назад`,
      tone: "neutral",
    };
  }
  const months = Math.max(1, Math.floor(days / 30));
  return {
    label: `${months} ${plural(months, "месяц", "месяца", "месяцев")} назад`,
    tone: "neutral",
  };
}

function playResult(result?: PlayResult | null): {
  label: string;
  tone: "success" | "danger" | "neutral";
} {
  if (result === "win") return { label: "Победа", tone: "success" };
  if (result === "loss") return { label: "Поражение", tone: "danger" };
  if (result === "score") return { label: "Счёт", tone: "neutral" };
  return { label: "—", tone: "neutral" };
}

function playersLabel(card: CollectionCardDto) {
  const min = card.item.minPlayers;
  const max = card.item.maxPlayers;
  if (min && max && min !== max) return `${min}–${max} игроков`;
  const count = min ?? max;
  return count
    ? `${count} ${plural(count, "игрок", "игрока", "игроков")}`
    : "—";
}

function durationLabel(card: CollectionCardDto) {
  const duration = card.item.maxPlayTime ?? card.item.minPlayTime;
  return duration ? `${duration} мин` : "—";
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function sortSelection(query: CollectionListQuery) {
  const sort = query.sort ?? "lastPlayed";
  const direction =
    sort === "title" ? (query.direction ?? "asc") : (query.direction ?? "desc");
  const value = `${sort}:${direction}`;
  return sortOptions.some((option) => option.value === value)
    ? value
    : "lastPlayed:desc";
}

export function collectionQueryFromUrl(
  searchParams: URLSearchParams,
): CollectionListQuery {
  const page = Number(searchParams.get("page") ?? 1);
  const type = searchParams.get("type") as ItemTypeCode | null;
  const sort = searchParams.get("sort") as CollectionListQuery["sort"] | null;
  const resolvedSort = sort || "lastPlayed";
  return {
    q: searchParams.get("q") || undefined,
    type: type || undefined,
    personalRating: optionalNumber(searchParams, "personalRating"),
    playsMin: optionalNumber(searchParams, "playsMin"),
    playsMax: optionalNumber(searchParams, "playsMax"),
    lastPlayedFrom: searchParams.get("lastPlayedFrom") || undefined,
    lastPlayedTo: searchParams.get("lastPlayedTo") || undefined,
    hasExpansions: optionalBoolean(searchParams, "hasExpansions"),
    hasActivePreorder: optionalBoolean(searchParams, "hasActivePreorder"),
    neverPlayed: optionalBoolean(searchParams, "neverPlayed"),
    notPlayedSince: searchParams.get("notPlayedSince") || undefined,
    location: searchParams.get("location") || undefined,
    tag: searchParams.getAll("tag"),
    favorite: optionalBoolean(searchParams, "favorite"),
    sort: resolvedSort,
    direction:
      searchParams.get("direction") === "asc"
        ? "asc"
        : resolvedSort === "title"
          ? "asc"
          : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 24,
  };
}

function optionalNumber(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalBoolean(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value === "true" ? true : value === "false" ? false : undefined;
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function collectionHref(params: URLSearchParams) {
  const value = params.toString();
  return value ? `/collection?${value}` : "/collection";
}
