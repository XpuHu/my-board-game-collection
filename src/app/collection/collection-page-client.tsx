"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, ListPlus, Search } from "lucide-react";

import { GameCover } from "@/components/game-cover";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import {
  collectionRestAdapter,
  type CollectionListQuery,
} from "@/features/collection/api";
import type { ItemTypeCode } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const ANY = "all";

export function CollectionPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = React.useMemo(
    () => collectionQueryFromUrl(searchParams),
    [searchParams],
  );
  const result = useAdapterQuery(collectionRestAdapter, query);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const q = String(form.get("q") ?? "").trim();
    const type = String(form.get("type") ?? ANY);
    const next = new URLSearchParams(searchParams.toString());
    setOrDelete(next, "q", q);
    setOrDelete(next, "type", type === ANY ? "" : type);
    next.delete("page");
    router.push(collectionHref(next));
  }

  function setSort(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    setOrDelete(next, "sort", value === "added" ? "" : value);
    next.delete("page");
    router.push(collectionHref(next));
  }

  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Моя коллекция</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Фильтры, сортировка и страница сохраняются в адресе.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new?target=collection">
            <ListPlus className="h-4 w-4" aria-hidden="true" />
            Добавить игру
          </Link>
        </Button>
      </header>

      <form key={searchParams.toString()} onSubmit={applyFilters} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(14rem,1fr)_12rem_10rem_auto] md:items-end">
        <div>
          <Label htmlFor="collection-search">Поиск</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="collection-search" name="q" defaultValue={query.q ?? ""} className="pl-9" placeholder="Название игры" />
          </div>
        </div>
        <div>
          <Label>Тип</Label>
          <select name="type" defaultValue={query.type ?? ANY} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value={ANY}>Все типы</option>
            <option value="base_game">Игры</option>
            <option value="expansion">Дополнения</option>
            <option value="accessory">Аксессуары</option>
            <option value="other">Другое</option>
          </select>
        </div>
        <div>
          <Label>Сортировка</Label>
          <select defaultValue={query.sort ?? "added"} onChange={(event) => setSort(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="added">Сначала новые</option>
            <option value="title">По названию</option>
            <option value="lastPlayed">По последней партии</option>
            <option value="plays">По числу партий</option>
            <option value="rating">По оценке</option>
          </select>
        </div>
        <Button type="submit">Применить</Button>
      </form>

      {result.isLoading ? <LoadingState /> : null}
      {result.error ? <ErrorState description={result.error} onRetry={result.reload} /> : null}
      {result.data && result.data.data.length === 0 ? (
        <EmptyState icon={Boxes} title="Ничего не найдено" description="Измените фильтры или добавьте игру в коллекцию." />
      ) : null}
      {result.data?.data.length ? (
        <>
          <section aria-label="Игры в коллекции" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {result.data.data.map((card) => (
              <Link key={card.item.id} href={`/collection/${card.item.id}`} className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 rounded-xl border bg-card p-3 transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <GameCover src={card.item.cover?.url ?? card.item.cover?.path} alt={card.item.cover?.alt ?? card.item.title} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{card.item.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{card.item.year ?? "Год не указан"}</span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{card.plays.count} партий</Badge>
                    {card.userItem.favorite ? <Badge>Избранное</Badge> : null}
                    {card.activePreorder ? <Badge variant="outline">Предзаказ</Badge> : null}
                  </span>
                </span>
              </Link>
            ))}
          </section>
          <Pagination
            page={result.data.pagination.page}
            totalPages={result.data.pagination.totalPages}
            createHref={(page) => {
              const next = new URLSearchParams(searchParams.toString());
              if (page <= 1) next.delete("page");
              else next.set("page", String(page));
              return collectionHref(next);
            }}
          />
        </>
      ) : null}
    </main>
  );
}

export function collectionQueryFromUrl(searchParams: URLSearchParams): CollectionListQuery {
  const page = Number(searchParams.get("page") ?? 1);
  const type = searchParams.get("type") as ItemTypeCode | null;
  const sort = searchParams.get("sort") as CollectionListQuery["sort"] | null;
  const direction = searchParams.get("direction");
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
    sort: sort || "added",
    direction: direction === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 24,
  };
}

function optionalNumber(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function optionalBoolean(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
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
