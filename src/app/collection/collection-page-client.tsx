"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Filter,
  ListPlus,
  RotateCcw,
  Search,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  apiClient,
  type CollectionQuery,
  type ItemListDto,
} from "@/shared/api";

const ANY_VALUE = "__any__";

const itemTypeOptions = [
  { value: ANY_VALUE, label: "Все типы" },
  { value: "base_game", label: "Игры" },
  { value: "expansion", label: "Дополнения" },
  { value: "accessory", label: "Аксессуары" },
  { value: "organizer", label: "Органайзеры" },
  { value: "component", label: "Компоненты" },
  { value: "other", label: "Другое" },
];

const ratingOptions = [
  { value: ANY_VALUE, label: "Любая оценка" },
  ...Array.from({ length: 10 }, (_, index) => {
    const rating = String(10 - index);
    return { value: rating, label: `${rating}/10` };
  }),
];

export function CollectionPageClient() {
  const [items, setItems] = React.useState<ItemListDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState({
    q: "",
    type: ANY_VALUE,
    rating: ANY_VALUE,
    location: "",
    tag: "",
    playedFrom: "",
    playedTo: "",
    hasActivePreorder: ANY_VALUE,
  });
  const [appliedFilters, setAppliedFilters] = React.useState(filters);

  const loadCollection = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.collection.list({
        ...toCollectionQuery(appliedFilters),
        pageSize: 50,
      });
      setItems(response.data);
      setTotal(response.pagination.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить коллекцию",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  React.useEffect(() => {
    let isActive = true;

    apiClient.collection
      .list({
        ...toCollectionQuery(appliedFilters),
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
            : "Не удалось загрузить коллекцию",
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
      type: ANY_VALUE,
      rating: ANY_VALUE,
      location: "",
      tag: "",
      playedFrom: "",
      playedTo: "",
      hasActivePreorder: ANY_VALUE,
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
          <h1 className="text-2xl font-semibold tracking-normal">
            Моя коллекция
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Компактный список owned-игр для быстрых ежедневных действий.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new">
            <ListPlus className="h-4 w-4" />
            Добавить игру
          </Link>
        </Button>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(16rem,1.6fr)_repeat(3,minmax(10rem,1fr))_auto]"
      >
        <div className="lg:col-span-2">
          <Label htmlFor="collection-search">Поиск</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="collection-search"
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              className="pl-9"
              placeholder="Название или оригинальное название"
            />
          </div>
        </div>

        <div>
          <Label>Тип</Label>
          <Select
            value={filters.type}
            onValueChange={(value) => updateFilter("type", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Оценка</Label>
          <Select
            value={filters.rating}
            onValueChange={(value) => updateFilter("rating", value)}
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
          <Label>Предзаказ</Label>
          <Select
            value={filters.hasActivePreorder}
            onValueChange={(value) => updateFilter("hasActivePreorder", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Не важно</SelectItem>
              <SelectItem value="true">Есть активный</SelectItem>
              <SelectItem value="false">Нет активного</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="collection-location">Место</Label>
          <Input
            id="collection-location"
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            className="mt-2"
            placeholder="Полка, шкаф"
          />
        </div>

        <div>
          <Label htmlFor="collection-tag">Тег</Label>
          <Input
            id="collection-tag"
            value={filters.tag}
            onChange={(event) => updateFilter("tag", event.target.value)}
            className="mt-2"
            placeholder="Соло, семья"
          />
        </div>

        <div>
          <Label htmlFor="collection-played-from">Партии с</Label>
          <Input
            id="collection-played-from"
            type="date"
            value={filters.playedFrom}
            onChange={(event) => updateFilter("playedFrom", event.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="collection-played-to">Партии до</Label>
          <Input
            id="collection-played-to"
            type="date"
            value={filters.playedTo}
            onChange={(event) => updateFilter("playedTo", event.target.value)}
            className="mt-2"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" className="min-w-28">
            <Filter className="h-4 w-4" />
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
          title="Загружаем коллекцию"
          description="Получаем компактный список owned-игр."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={loadCollection} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Коллекция пуста"
          description="Добавленные owned-игры появятся здесь без длинных описаний: название, оценка, партии и последнее сыгранное."
          action={
            <Button asChild>
              <Link href="/items/new">
                <ListPlus className="h-4 w-4" />
                Добавить игру
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="text-sm font-medium">{totalLabel(total)}</div>
            <div className="text-xs text-muted-foreground">
              Показано {items.length}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="w-32">Оценка</TableHead>
                <TableHead className="w-32">Партии</TableHead>
                <TableHead className="w-44">Последняя партия</TableHead>
                <TableHead className="w-44">Место</TableHead>
                <TableHead className="w-28 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <CollectionRow key={entry.item.id} entry={entry} />
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </main>
  );
}

function CollectionRow({ entry }: { entry: ItemListDto }) {
  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/collection/${entry.item.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {entry.item.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{entry.item.type.name}</span>
          {entry.item.year ? <span>{entry.item.year}</span> : null}
          {entry.activePreordersCount > 0 ? (
            <Badge variant="secondary">
              {entry.activePreordersCount} предзаказ
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <RatingValue value={entry.userItem.personalRating} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>{entry.playsCount}</span>
        </div>
      </TableCell>
      <TableCell>{formatDate(entry.lastPlayedAt)}</TableCell>
      <TableCell className="text-muted-foreground">
        {entry.userItem.location || "Не указано"}
      </TableCell>
      <TableCell className="text-right">
        <Button asChild variant="outline" size="sm">
          <Link href={`/collection/${entry.item.id}`}>Открыть</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function RatingValue({ value }: { value?: number | null }) {
  if (!value) {
    return <span className="text-muted-foreground">Нет</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 font-medium">
      <Star className="h-4 w-4 fill-primary text-primary" />
      {value}/10
    </span>
  );
}

function toCollectionQuery(filters: Record<string, string>): CollectionQuery {
  return {
    q: filters.q.trim() || undefined,
    type: filters.type === ANY_VALUE ? undefined : filters.type,
    rating: filters.rating === ANY_VALUE ? undefined : Number(filters.rating),
    location: filters.location.trim() || undefined,
    tag: filters.tag.trim() || undefined,
    playedFrom: filters.playedFrom || undefined,
    playedTo: filters.playedTo || undefined,
    hasActivePreorder:
      filters.hasActivePreorder === ANY_VALUE
        ? undefined
        : filters.hasActivePreorder === "true",
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return <span className="text-muted-foreground">Не было</span>;
  }

  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function totalLabel(total: number) {
  if (total === 1) {
    return "1 игра в коллекции";
  }

  return `${total} игр в коллекции`;
}
