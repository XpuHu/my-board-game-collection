"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  ListFilter,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Trash2,
} from "lucide-react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { GameCover } from "@/components/game-cover";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import {
  addWishlistItemToCollection,
  removeWishlistItem,
  wishlistRestAdapter,
  type WishlistListQuery,
} from "@/features/wishlist/api";
import type { WishlistCardDto } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const ANY_VALUE = "__any__";

export function WishlistPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const query = React.useMemo(
    () => wishlistQueryFromUrl(searchParams),
    [searchParams],
  );
  const result = useAdapterQuery(wishlistRestAdapter, query);
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null);
  const [removeEntry, setRemoveEntry] = React.useState<WishlistCardDto | null>(
    null,
  );

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams.toString());

    setOrDelete(next, "q", String(form.get("q") ?? "").trim());
    setOrDelete(next, "type", optionalSelect(form, "type"));
    setOrDelete(next, "ratingMin", optionalSelect(form, "ratingMin"));
    setOrDelete(next, "players", String(form.get("players") ?? ""));
    setOrDelete(next, "playTimeMax", String(form.get("playTimeMax") ?? ""));
    setOrDelete(next, "complexityMin", String(form.get("complexityMin") ?? ""));
    setOrDelete(next, "complexityMax", String(form.get("complexityMax") ?? ""));
    setOrDelete(
      next,
      "hasLocalization",
      optionalSelect(form, "hasLocalization"),
    );
    setOrDelete(next, "hasPrice", optionalSelect(form, "hasPrice"));
    setOrDelete(next, "interestLevel", optionalSelect(form, "interestLevel"));
    setOrDelete(next, "sort", optionalSelect(form, "sort", "interest"));
    setOrDelete(next, "direction", optionalSelect(form, "direction", "desc"));
    setArray(next, "mechanic", splitValues(String(form.get("mechanic") ?? "")));
    setArray(next, "category", splitValues(String(form.get("category") ?? "")));
    next.delete("page");
    router.push(wishlistHref(next));
  }

  async function addToCollection(entry: WishlistCardDto) {
    setBusyItemId(entry.item.id);
    try {
      await addWishlistItemToCollection(entry.item.id);
      toast({
        title: "Добавлено в коллекцию",
        description: "Справочная карточка и пользовательские данные сохранены.",
        variant: "success",
      });
      router.push(`/collection/${entry.item.id}`);
    } catch (error) {
      toast({
        title: "Не удалось добавить в коллекцию",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setBusyItemId(null);
    }
  }

  async function confirmRemove() {
    if (!removeEntry) return;
    const itemId = removeEntry.item.id;
    setBusyItemId(itemId);
    try {
      await removeWishlistItem(itemId);
      toast({
        title: "Удалено из wishlist",
        description: "Item, ссылки, история и предзаказы не удалены.",
        variant: "success",
      });
      result.reload();
    } catch (error) {
      toast({
        title: "Не удалось удалить из wishlist",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setBusyItemId(null);
      setRemoveEntry(null);
    }
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Игры для следующей покупки или предзаказа.
          </p>
        </div>
        <Button asChild>
          <Link href="/items/new?target=wishlist">
            <Star className="h-4 w-4" /> Добавить в wishlist
          </Link>
        </Button>
      </header>

      <form
        key={searchParams.toString()}
        onSubmit={applyFilters}
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end"
      >
        <div className="xl:col-span-3">
          <Label htmlFor="wishlist-search">Поиск</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="wishlist-search"
              name="q"
              defaultValue={query.q ?? ""}
              className="pl-9"
            />
          </div>
        </div>
        <SelectField
          name="type"
          label="Тип"
          value={query.type ?? ANY_VALUE}
          options={[
            [ANY_VALUE, "Любой"],
            ["base_game", "Базовая игра"],
            ["expansion", "Дополнение"],
            ["promo", "Промо"],
            ["accessory", "Аксессуар"],
            ["organizer", "Органайзер"],
            ["component", "Компонент"],
            ["other", "Другое"],
          ]}
        />
        <SelectField
          name="ratingMin"
          label="Рейтинг от"
          value={query.ratingMin?.toString() ?? ANY_VALUE}
          options={[
            [ANY_VALUE, "Любой"],
            ...Array.from({ length: 10 }, (_, index) => [
              String(10 - index),
              String(10 - index),
            ]),
          ]}
        />
        <NumberField name="players" label="Игроков" value={query.players} />
        <NumberField
          name="playTimeMax"
          label="До минут"
          value={query.playTimeMax}
        />
        <NumberField
          name="complexityMin"
          label="Сложность от"
          value={query.complexityMin}
        />
        <NumberField
          name="complexityMax"
          label="Сложность до"
          value={query.complexityMax}
        />
        <SelectField
          name="hasLocalization"
          label="Локализация"
          value={
            query.hasLocalization === undefined
              ? ANY_VALUE
              : String(query.hasLocalization)
          }
          options={[
            [ANY_VALUE, "Не важно"],
            ["true", "Есть"],
            ["false", "Нет"],
          ]}
        />
        <SelectField
          name="hasPrice"
          label="Цена"
          value={
            query.hasPrice === undefined ? ANY_VALUE : String(query.hasPrice)
          }
          options={[
            [ANY_VALUE, "Не важно"],
            ["true", "Есть сигнал"],
            ["false", "Нет сигнала"],
          ]}
        />
        <SelectField
          name="interestLevel"
          label="Интерес"
          value={query.interestLevel?.toString() ?? ANY_VALUE}
          options={[
            [ANY_VALUE, "Любой"],
            ["5", "5 — высокий"],
            ["4", "4"],
            ["3", "3"],
            ["2", "2"],
            ["1", "1 — низкий"],
          ]}
        />
        <SelectField
          name="sort"
          label="Сортировка"
          value={query.sort ?? "interest"}
          options={[
            ["interest", "По интересу"],
            ["rating", "По рейтингу"],
            ["year", "По году"],
            ["title", "По названию"],
            ["updated", "По обновлению"],
          ]}
        />
        <SelectField
          name="direction"
          label="Порядок"
          value={query.direction ?? "desc"}
          options={[
            ["desc", "По убыванию"],
            ["asc", "По возрастанию"],
          ]}
        />
        <div className="xl:col-span-2">
          <Label htmlFor="wishlist-mechanic">Механики</Label>
          <Input
            id="wishlist-mechanic"
            name="mechanic"
            defaultValue={query.mechanic?.join(", ") ?? ""}
            className="mt-2"
          />
        </div>
        <div className="xl:col-span-2">
          <Label htmlFor="wishlist-category">Категории</Label>
          <Input
            id="wishlist-category"
            name="category"
            defaultValue={query.category?.join(", ") ?? ""}
            className="mt-2"
          />
        </div>
        <div className="flex gap-2 xl:col-span-2">
          <Button type="submit">
            <ListFilter className="h-4 w-4" /> Найти
          </Button>
          <Button asChild type="button" variant="outline" size="icon">
            <Link href="/wishlist" aria-label="Сбросить фильтры">
              <RotateCcw className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </form>

      {result.isLoading ? (
        <LoadingState
          title="Загружаем wishlist"
          description="Получаем игры и справочные сигналы."
        />
      ) : null}
      {result.error ? (
        <ErrorState description={result.error} onRetry={result.reload} />
      ) : null}
      {result.data && result.data.data.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Wishlist пока пуст"
          description="Измените фильтры или добавьте игру."
        />
      ) : null}
      {result.data?.data.length ? (
        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <strong>{result.data.pagination.total} игр</strong>
            <span className="text-muted-foreground">
              Страница {result.data.pagination.page}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {result.data.data.map((entry) => (
              <WishlistCard
                key={entry.item.id}
                entry={entry}
                busy={busyItemId === entry.item.id}
                onAddToCollection={() => addToCollection(entry)}
                onRemove={() => setRemoveEntry(entry)}
              />
            ))}
          </div>
          <Pagination
            page={result.data.pagination.page}
            totalPages={result.data.pagination.totalPages}
            createHref={(page) => {
              const next = new URLSearchParams(searchParams.toString());
              if (page <= 1) next.delete("page");
              else next.set("page", String(page));
              return wishlistHref(next);
            }}
          />
        </section>
      ) : null}

      <ConfirmationDialog
        open={Boolean(removeEntry)}
        onOpenChange={(open) => {
          if (!open) setRemoveEntry(null);
        }}
        title="Удалить из wishlist?"
        description={`«${removeEntry?.item.title ?? "Игра"}» исчезнет из списка, но Item, история, ссылки и предзаказы сохранятся.`}
        confirmLabel="Удалить из wishlist"
        destructive
        onConfirm={confirmRemove}
      />
    </main>
  );
}

function WishlistCard({
  entry,
  busy,
  onAddToCollection,
  onRemove,
}: {
  entry: WishlistCardDto;
  busy: boolean;
  onAddToCollection: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[6.5rem_1fr] gap-4 rounded-xl border bg-card p-4">
      <GameCover
        src={entry.item.cover?.url ?? entry.item.cover?.path}
        alt={entry.item.cover?.alt ?? entry.item.title}
        size="card"
      />
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/wishlist/${entry.item.id}`}
              className="line-clamp-2 font-semibold hover:underline"
            >
              {entry.item.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.item.year ?? "Год не указан"} · {entry.item.type.name}
            </p>
          </div>
          {entry.item.communityRating ? (
            <Badge variant="secondary">
              <Star className="mr-1 h-3 w-3 fill-current" />
              {entry.item.communityRating.toFixed(1)}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>Игроки: {players(entry)}</span>
          <span>Время: {playTime(entry)}</span>
          <span>
            Интерес:{" "}
            {entry.userItem.interestLevel
              ? `${entry.userItem.interestLevel}/5`
              : "—"}
          </span>
          <span>
            Цена:{" "}
            {entry.priceSignal
              ? money(entry.priceSignal.amount, entry.priceSignal.currency)
              : "—"}
          </span>
        </div>
        {entry.mechanics.length ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {entry.mechanics.slice(0, 3).map((mechanic) => (
              <Badge
                key={mechanic}
                variant="outline"
                className="max-w-full truncate"
              >
                {mechanic}
              </Badge>
            ))}
          </div>
        ) : null}
        {entry.activePreorder ? (
          <Badge className="mt-3 w-fit">
            <ShoppingBag className="mr-1 h-3 w-3" />
            Есть предзаказ
          </Badge>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Button asChild size="sm" variant="outline">
            <Link href={`/wishlist/${entry.item.id}`}>Подробнее</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAddToCollection}
            disabled={busy}
            aria-label="Добавить в коллекцию"
          >
            <Boxes className="h-4 w-4" />
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            aria-label="Оформить предзаказ"
          >
            <Link href={`/wishlist/${entry.item.id}?action=preorder`}>
              <ShoppingBag className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={busy}
            aria-label="Удалить из wishlist"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function SelectField({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[][];
}) {
  return (
    <div>
      <Label htmlFor={`wishlist-${name}`}>{label}</Label>
      <select
        id={`wishlist-${name}`}
        name={name}
        defaultValue={value}
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: number;
}) {
  const complexity = name.startsWith("complexity");
  return (
    <div>
      <Label htmlFor={`wishlist-${name}`}>{label}</Label>
      <Input
        id={`wishlist-${name}`}
        name={name}
        type="number"
        min={complexity ? 0 : 1}
        max={complexity ? 5 : undefined}
        step={complexity ? 0.1 : 1}
        defaultValue={value ?? ""}
        className="mt-2"
      />
    </div>
  );
}

export function wishlistQueryFromUrl(
  searchParams: URLSearchParams,
): WishlistListQuery {
  const boolean = (key: string) =>
    searchParams.get(key) === null
      ? undefined
      : searchParams.get(key) === "true";
  const number = (key: string) => {
    const value = searchParams.get(key);
    return value ? Number(value) : undefined;
  };
  return {
    q: searchParams.get("q") || undefined,
    type: (searchParams.get("type") as WishlistListQuery["type"]) || undefined,
    ratingMin: number("ratingMin"),
    players: number("players"),
    playTimeMax: number("playTimeMax"),
    complexityMin: number("complexityMin"),
    complexityMax: number("complexityMax"),
    mechanic: searchParams.getAll("mechanic").filter(Boolean) || undefined,
    category: searchParams.getAll("category").filter(Boolean) || undefined,
    hasLocalization: boolean("hasLocalization"),
    hasPrice: boolean("hasPrice"),
    interestLevel: number("interestLevel"),
    sort: (searchParams.get("sort") as WishlistListQuery["sort"]) || undefined,
    direction:
      (searchParams.get("direction") as WishlistListQuery["direction"]) ||
      undefined,
    page: number("page"),
    pageSize: 24,
  };
}

function optionalSelect(form: FormData, key: string, defaultValue?: string) {
  const value = String(form.get(key) ?? "");
  return value === ANY_VALUE || value === defaultValue ? "" : value;
}
function splitValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
function setArray(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  values.forEach((value) => params.append(key, value));
}
export function wishlistHref(params: URLSearchParams) {
  const value = params.toString();
  return value ? `/wishlist?${value}` : "/wishlist";
}
function players(entry: WishlistCardDto) {
  const { minPlayers: min, maxPlayers: max } = entry.item;
  return min && max && min !== max
    ? `${min}–${max}`
    : String(min ?? max ?? "—");
}
function playTime(entry: WishlistCardDto) {
  const { minPlayTime: min, maxPlayTime: max } = entry.item;
  return min && max && min !== max
    ? `${min}–${max} мин`
    : min || max
      ? `${min ?? max} мин`
      : "—";
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
