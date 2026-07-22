"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, CalendarPlus, ListPlus, Search, SlidersHorizontal, Star } from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { GameCover } from "@/components/game-cover";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import {
  collectionRestAdapter,
  updateCollectionFavorite,
  type CollectionListQuery,
} from "@/features/collection/api";
import type { CollectionCardDto, ItemTypeCode } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const typeTabs: { label: string; value?: ItemTypeCode }[] = [
  { label: "Все" },
  { label: "Игры", value: "base_game" },
  { label: "Дополнения", value: "expansion" },
  { label: "Аксессуары", value: "accessory" },
  { label: "Другое", value: "other" },
];

export function CollectionPageClient() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = React.useMemo(() => collectionQueryFromUrl(searchParams), [searchParams]);
  const result = useAdapterQuery(collectionRestAdapter, query);
  const [playCard, setPlayCard] = React.useState<CollectionCardDto | null>(null);
  const [favoriteOverrides, setFavoriteOverrides] = React.useState<Record<string, boolean>>({});
  const [favoriteSaving, setFavoriteSaving] = React.useState<Set<string>>(() => new Set());

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

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams.toString());
    setOrDelete(next, "q", String(form.get("q") ?? "").trim());
    setOrDelete(next, "sort", String(form.get("sort") ?? "") === "added" ? "" : String(form.get("sort") ?? ""));
    setOrDelete(next, "direction", String(form.get("direction") ?? "") === "desc" ? "" : String(form.get("direction") ?? ""));
    setOrDelete(next, "playsMin", String(form.get("playsMin") ?? ""));
    setOrDelete(next, "location", String(form.get("location") ?? "").trim());
    applyStateFilter(next, String(form.get("state") ?? "all"));
    next.delete("page");
    router.push(collectionHref(next));
  }

  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Моя коллекция</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Карточки владельца, история партий и быстрые действия.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new?target=collection">
            <ListPlus className="h-4 w-4" /> Добавить игру
          </Link>
        </Button>
      </header>

      <nav aria-label="Тип предмета" className="flex gap-2 overflow-x-auto pb-1">
        {typeTabs.map((tab) => {
          const active = (query.type ?? undefined) === tab.value;
          const next = new URLSearchParams(searchParams.toString());
          setOrDelete(next, "type", tab.value ?? "");
          next.delete("page");
          return (
            <Button key={tab.label} asChild size="sm" variant={active ? "default" : "outline"}>
              <Link href={collectionHref(next)}>{tab.label}</Link>
            </Button>
          );
        })}
      </nav>

      <form key={searchParams.toString()} onSubmit={applyFilters} className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-4">
          <Label htmlFor="collection-search">Поиск</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="collection-search" name="q" defaultValue={query.q ?? ""} className="pl-9" placeholder="Название игры" />
          </div>
        </div>
        <SelectField label="Состояние" name="state" defaultValue={stateFromQuery(query)} options={[
          ["all", "Все"], ["favorite", "Избранное"], ["recent", "Недавно играли"], ["stale", "Давно не играли"], ["never", "Ни одной партии"], ["preorder", "Есть предзаказ"],
        ]} className="lg:col-span-2" />
        <SelectField label="Сортировка" name="sort" defaultValue={query.sort ?? "added"} options={[
          ["added", "По добавлению"], ["lastPlayed", "По последней партии"], ["plays", "По числу партий"], ["rating", "По оценке"], ["title", "По названию"],
        ]} className="lg:col-span-2" />
        <SelectField label="Порядок" name="direction" defaultValue={query.direction ?? "desc"} options={[["desc", "По убыванию"], ["asc", "По возрастанию"]]} className="lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <div><Label htmlFor="plays-min">Партий от</Label><Input id="plays-min" name="playsMin" type="number" min={0} defaultValue={query.playsMin ?? ""} className="mt-2" /></div>
          <div><Label htmlFor="collection-location">Полка</Label><Input id="collection-location" name="location" defaultValue={query.location ?? ""} className="mt-2" /></div>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-12">
          <Button type="submit"><SlidersHorizontal className="h-4 w-4" /> Применить</Button>
          <Button asChild type="button" variant="ghost"><Link href="/collection">Сбросить</Link></Button>
        </div>
      </form>

      {result.isLoading ? <LoadingState /> : null}
      {result.error ? <ErrorState description={result.error} onRetry={result.reload} /> : null}
      {result.data && result.data.data.length === 0 ? (
        <EmptyState icon={Boxes} title="Ничего не найдено" description="Измените фильтры или добавьте игру в коллекцию." />
      ) : null}
      {result.data?.data.length ? (
        <>
          <p className="text-sm text-muted-foreground">Найдено: {result.data.pagination.total}</p>
          <section aria-label="Игры в коллекции" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {result.data.data.map((card) => {
              const favorite = favoriteOverrides[card.item.id] ?? card.userItem.favorite;
              return <CollectionCard
                key={card.item.id}
                card={{ ...card, userItem: { ...card.userItem, favorite } }}
                favoriteSaving={favoriteSaving.has(card.item.id)}
                onToggleFavorite={() => toggleFavorite(card)}
                onAddPlay={() => setPlayCard(card)}
              />;
            })}
          </section>
          <Pagination page={result.data.pagination.page} totalPages={result.data.pagination.totalPages} createHref={(page) => {
            const next = new URLSearchParams(searchParams.toString());
            if (page <= 1) next.delete("page"); else next.set("page", String(page));
            return collectionHref(next);
          }} />
        </>
      ) : null}

      {playCard ? <AddPlayDialog
        open={Boolean(playCard)}
        onOpenChange={(open) => { if (!open) setPlayCard(null); }}
        initialItemId={playCard?.item.id}
        initialItemTitle={playCard?.item.title}
        onSaved={result.reload}
      /> : null}
    </main>
  );
}

function CollectionCard({ card, favoriteSaving, onToggleFavorite, onAddPlay }: { card: CollectionCardDto; favoriteSaving: boolean; onToggleFavorite: () => void; onAddPlay: () => void }) {
  const state = playState(card);
  return (
    <article className="relative flex min-w-0 flex-col rounded-xl border bg-card p-3 transition-colors hover:bg-[var(--bg-surface-hover)]">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute right-5 top-5 z-10 shadow-sm"
        aria-label={card.userItem.favorite ? "Удалить из избранного" : "Добавить в избранное"}
        aria-pressed={card.userItem.favorite}
        disabled={favoriteSaving}
        onClick={onToggleFavorite}
      >
        <Star className="h-4 w-4" fill={card.userItem.favorite ? "currentColor" : "none"} />
      </Button>
      <Link href={`/collection/${card.item.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <GameCover src={card.item.cover?.url ?? card.item.cover?.path} alt={card.item.cover?.alt ?? card.item.title} size="card" />
        <h2 className="mt-3 line-clamp-2 font-semibold">{card.item.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{card.item.year ?? "Год не указан"}</p>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">{card.plays.count} партий</Badge>
        <Badge variant={state.variant}>{state.label}</Badge>
        {card.activePreorder ? <Badge variant="outline">Предзаказ</Badge> : null}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4 text-xs text-muted-foreground">
        <span>Оценка: {card.userItem.personalRating ?? "—"}</span>
        <span className="text-right">{card.userItem.location ?? "Без места"}</span>
      </div>
      <Button type="button" size="sm" className="mt-3 w-full" onClick={onAddPlay}>
        <CalendarPlus className="h-4 w-4" /> Партия
      </Button>
    </article>
  );
}

function playState(card: CollectionCardDto): { label: string; variant: "default" | "secondary" | "outline" } {
  if (!card.plays.lastPlayedAt) return { label: "Не играли", variant: "outline" };
  const days = (Date.now() - new Date(card.plays.lastPlayedAt).getTime()) / 86_400_000;
  if (days <= 30) return { label: "Недавно", variant: "default" };
  if (days >= 180) return { label: "Давно", variant: "secondary" };
  return { label: "Играли", variant: "secondary" };
}

function SelectField({ label, name, defaultValue, options, className }: { label: string; name: string; defaultValue: string; options: string[][]; className?: string }) {
  return <div className={className}><Label htmlFor={`collection-${name}`}>{label}</Label><select id={`collection-${name}`} name={name} defaultValue={defaultValue} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>;
}

function stateFromQuery(query: CollectionListQuery) {
  if (query.favorite) return "favorite";
  if (query.neverPlayed) return "never";
  if (query.hasActivePreorder) return "preorder";
  if (query.notPlayedSince) return "stale";
  if (query.lastPlayedFrom) return "recent";
  return "all";
}

function applyStateFilter(params: URLSearchParams, state: string) {
  ["neverPlayed", "hasActivePreorder", "notPlayedSince", "lastPlayedFrom", "favorite"].forEach((key) => params.delete(key));
  if (state === "favorite") params.set("favorite", "true");
  if (state === "never") params.set("neverPlayed", "true");
  if (state === "preorder") params.set("hasActivePreorder", "true");
  if (state === "recent") params.set("lastPlayedFrom", dateDaysAgo(30));
  if (state === "stale") {
    params.set("notPlayedSince", dateDaysAgo(180));
    params.set("neverPlayed", "false");
  }
}

function dateDaysAgo(days: number) {
  const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10);
}

export function collectionQueryFromUrl(searchParams: URLSearchParams): CollectionListQuery {
  const page = Number(searchParams.get("page") ?? 1);
  const type = searchParams.get("type") as ItemTypeCode | null;
  const sort = searchParams.get("sort") as CollectionListQuery["sort"] | null;
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
    direction: searchParams.get("direction") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 24,
  };
}

function optionalNumber(params: URLSearchParams, key: string) { const value = params.get(key); if (!value) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function optionalBoolean(params: URLSearchParams, key: string) { const value = params.get(key); return value === "true" ? true : value === "false" ? false : undefined; }
function setOrDelete(params: URLSearchParams, key: string, value: string) { if (value) params.set(key, value); else params.delete(key); }
export function collectionHref(params: URLSearchParams) { const value = params.toString(); return value ? `/collection?${value}` : "/collection"; }
