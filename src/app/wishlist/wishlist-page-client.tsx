"use client";

import * as React from "react";
import Link from "next/link";
import {
  ImageIcon,
  ListFilter,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient, type ItemListDto, type WishlistQuery } from "@/shared/api";

const ANY_VALUE = "__any__";

const ratingOptions = [
  { value: ANY_VALUE, label: "Любой рейтинг" },
  ...Array.from({ length: 10 }, (_, index) => {
    const rating = String(10 - index);
    return { value: rating, label: `от ${rating}` };
  }),
];

export function WishlistPageClient() {
  const [items, setItems] = React.useState<ItemListDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState({
    q: "",
    minRating: ANY_VALUE,
    players: "",
    maxPlayTime: "",
    mechanics: "",
    categories: "",
    hasPrice: ANY_VALUE,
  });
  const [appliedFilters, setAppliedFilters] = React.useState(filters);

  const loadWishlist = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.wishlist.list({
        ...toWishlistQuery(appliedFilters),
        pageSize: 50,
      });
      setItems(response.data);
      setTotal(response.pagination.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить wishlist",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  React.useEffect(() => {
    let isActive = true;

    apiClient.wishlist
      .list({
        ...toWishlistQuery(appliedFilters),
        pageSize: 50,
      })
      .then((response) => {
        if (!isActive) {
          return;
        }

        setItems(response.data);
        setTotal(response.pagination.total);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить wishlist",
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
  }, [appliedFilters]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAppliedFilters(filters);
  }

  function resetFilters() {
    const nextFilters = {
      q: "",
      minRating: ANY_VALUE,
      players: "",
      maxPlayTime: "",
      mechanics: "",
      categories: "",
      hasPrice: ANY_VALUE,
    };
    setFilters(nextFilters);
    setLoading(true);
    setError(null);
    setAppliedFilters(nextFilters);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Подробный список игр для выбора следующей покупки или предзаказа.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new?target=wishlist">
            <Star className="h-4 w-4" />
            Добавить в wishlist
          </Link>
        </Button>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(16rem,1.4fr)_repeat(4,minmax(9rem,1fr))_auto]"
      >
        <div className="lg:col-span-2">
          <Label htmlFor="wishlist-search">Поиск</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="wishlist-search"
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              className="pl-9"
              placeholder="Название или оригинальное название"
            />
          </div>
        </div>

        <div>
          <Label>Рейтинг</Label>
          <Select
            value={filters.minRating}
            onValueChange={(value) => updateFilter("minRating", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ratingOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="wishlist-players">Игроков</Label>
          <Input
            id="wishlist-players"
            type="number"
            min={1}
            value={filters.players}
            onChange={(event) => updateFilter("players", event.target.value)}
            className="mt-2"
            placeholder="2"
          />
        </div>

        <div>
          <Label htmlFor="wishlist-playtime">До минут</Label>
          <Input
            id="wishlist-playtime"
            type="number"
            min={1}
            value={filters.maxPlayTime}
            onChange={(event) =>
              updateFilter("maxPlayTime", event.target.value)
            }
            className="mt-2"
            placeholder="90"
          />
        </div>

        <div>
          <Label>Цена</Label>
          <Select
            value={filters.hasPrice}
            onValueChange={(value) => updateFilter("hasPrice", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Не важно</SelectItem>
              <SelectItem value="true">Есть сигнал</SelectItem>
              <SelectItem value="false">Нет сигнала</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="wishlist-mechanics">Механики</Label>
          <Input
            id="wishlist-mechanics"
            value={filters.mechanics}
            onChange={(event) => updateFilter("mechanics", event.target.value)}
            className="mt-2"
            placeholder="Deck Building"
          />
        </div>

        <div>
          <Label htmlFor="wishlist-categories">Категории</Label>
          <Input
            id="wishlist-categories"
            value={filters.categories}
            onChange={(event) => updateFilter("categories", event.target.value)}
            className="mt-2"
            placeholder="Animals"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" className="min-w-28">
            <ListFilter className="h-4 w-4" />
            Найти
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={resetFilters}
            title="Сбросить фильтры"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Сбросить фильтры</span>
          </Button>
        </div>
      </form>

      {loading ? (
        <LoadingState
          title="Загружаем wishlist"
          description="Получаем игры и справочные сигналы."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={loadWishlist} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Wishlist пока пуст"
          description="Добавленные игры появятся здесь с обложками, рейтингами, фильтрами и действиями покупки."
          action={
            <Button asChild>
              <Link href="/items/new?target=wishlist">
                <Star className="h-4 w-4" />
                Добавить в wishlist
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{totalLabel(total)}</div>
            <div className="text-xs text-muted-foreground">
              Показано {items.length}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((entry) => (
              <WishlistCard key={entry.item.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function WishlistCard({ entry }: { entry: ItemListDto }) {
  return (
    <article className="grid min-h-52 grid-cols-[7rem_1fr] gap-4 rounded-lg border bg-card p-4">
      <div className="overflow-hidden rounded-md border bg-secondary">
        {entry.mainImage?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.mainImage.url}
            alt=""
            className="h-full min-h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-44 items-center justify-center text-muted-foreground">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="min-w-0">
          <Link
            href={`/wishlist/${entry.item.id}`}
            className="font-semibold text-foreground hover:underline"
          >
            {entry.item.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{entry.item.type.name}</Badge>
            {entry.item.year ? (
              <Badge variant="outline">{entry.item.year}</Badge>
            ) : null}
            {entry.activePreordersCount > 0 ? (
              <Badge>
                <ShoppingBag className="mr-1 h-3 w-3" />
                {entry.activePreordersCount}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <InfoValue
            label="BGG"
            value={entry.item.rating ? entry.item.rating.toFixed(1) : "Нет"}
          />
          <InfoValue
            label="Интерес"
            value={
              entry.userItem.interestLevel
                ? `${entry.userItem.interestLevel}/5`
                : "Нет"
            }
          />
        </div>

        <div className="mt-auto pt-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/wishlist/${entry.item.id}`}>Открыть</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function toWishlistQuery(filters: Record<string, string>): WishlistQuery {
  return {
    q: filters.q.trim() || undefined,
    minRating:
      filters.minRating === ANY_VALUE ? undefined : Number(filters.minRating),
    players: filters.players ? Number(filters.players) : undefined,
    maxPlayTime: filters.maxPlayTime
      ? Number(filters.maxPlayTime)
      : undefined,
    mechanics: splitFilterValues(filters.mechanics),
    categories: splitFilterValues(filters.categories),
    hasPrice:
      filters.hasPrice === ANY_VALUE ? undefined : filters.hasPrice === "true",
  };
}

function splitFilterValues(value: string) {
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

function totalLabel(total: number) {
  if (total === 1) {
    return "1 игра в wishlist";
  }

  return `${total} игр в wishlist`;
}
