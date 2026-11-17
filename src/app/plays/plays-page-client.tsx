"use client";
import { Dropdown } from "@/components/ui/dropdown";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Edit3, History, RotateCcw, Trash2 } from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { GameCover } from "@/components/game-cover";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { collectionRestAdapter } from "@/features/collection/api";
import {
  deletePlay,
  playsRestAdapter,
  type PlaysListQuery,
} from "@/features/plays/api";
import type { PlayListItemDto, PlayResult } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const ALL = "all";

export function PlaysPageClient({ initialItemId }: { initialItemId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const query = React.useMemo(
    () => playsQueryFromUrl(searchParams, initialItemId),
    [searchParams, initialItemId],
  );
  const result = useAdapterQuery(playsRestAdapter, query);
  const collection = useAdapterQuery(
    collectionRestAdapter,
    {
      page: 1,
      pageSize: 24,
      sort: "title" as const,
      direction: "asc" as const,
    },
    { key: "plays-filter-items" },
  );
  const [dialogOpen, setDialogOpen] = React.useState(Boolean(initialItemId));
  const [editing, setEditing] = React.useState<PlayListItemDto | null>(null);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of [
      "itemId",
      "from",
      "to",
      "result",
      "source",
      "player",
      "playersMin",
      "playersMax",
      "durationMin",
      "durationMax",
      "usedItemId",
    ] as const) {
      const value = String(form.get(key) ?? "");
      if (value && value !== ALL) next.set(key, value);
    }
    if (
      (next.has("player") || next.has("usedItemId")) &&
      !next.has("from") &&
      !next.has("to")
    ) {
      toast({
        title: "Укажите период",
        description:
          "Фильтр по игроку или дополнению требует начальную или конечную дату.",
        variant: "error",
      });
      return;
    }
    router.push(playsHref(next));
  }

  async function remove(play: PlayListItemDto) {
    if (!window.confirm(`Удалить партию ${formatDate(play.playedAt)}?`)) return;
    try {
      await deletePlay(play.id);
      toast({ title: "Партия удалена", variant: "success" });
      result.reload();
    } catch (error) {
      toast({
        title: "Не удалось удалить партию",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Партии</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            История ручных и импортированных партий.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Добавить партию
        </Button>
      </header>

      <form
        key={searchParams.toString()}
        onSubmit={applyFilters}
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end"
      >
        <SelectFilter
          label="Игра"
          name="itemId"
          defaultValue={query.itemId ?? ALL}
        >
          <option value={ALL}>Все игры</option>
          {collection.data?.data.map(({ item }) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </SelectFilter>
        <div>
          <Label htmlFor="plays-from">С даты</Label>
          <Input
            id="plays-from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="plays-to">По дату</Label>
          <Input
            id="plays-to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="mt-2"
          />
        </div>
        <SelectFilter
          label="Результат"
          name="result"
          defaultValue={query.result ?? ALL}
        >
          <option value={ALL}>Любой</option>
          <option value="win">Победа</option>
          <option value="loss">Поражение</option>
          <option value="score">Счёт</option>
          <option value="unknown">Неизвестно</option>
        </SelectFilter>
        <SelectFilter
          label="Источник"
          name="source"
          defaultValue={query.source ?? ALL}
        >
          <option value={ALL}>Все</option>
          <option value="manual">Ручные</option>
          <option value="boardgamegeek">BGG</option>
        </SelectFilter>
        <div>
          <Label htmlFor="plays-player">Игрок</Label>
          <Input
            id="plays-player"
            name="player"
            defaultValue={query.player ?? query.playerName ?? ""}
            className="mt-2"
            placeholder="Имя"
          />
        </div>
        <NumberRange
          label="Участников"
          nameMin="playersMin"
          nameMax="playersMax"
          min={1}
          defaultMin={query.playersMin}
          defaultMax={query.playersMax}
        />
        <NumberRange
          label="Длительность, мин"
          nameMin="durationMin"
          nameMax="durationMax"
          min={0}
          defaultMin={query.durationMin}
          defaultMax={query.durationMax}
        />
        <SelectFilter
          label="Дополнение"
          name="usedItemId"
          defaultValue={query.usedItemId ?? ALL}
        >
          <option value={ALL}>Любое</option>
          {collection.data?.data
            .filter(({ item }) => item.type.code === "expansion")
            .map(({ item }) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
        </SelectFilter>
        <div className="flex gap-2 xl:col-span-3">
          <Button type="submit">Показать</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/plays">
              <RotateCcw className="h-4 w-4" /> Сбросить
            </Link>
          </Button>
        </div>
      </form>

      {result.isLoading ? (
        <LoadingState
          title="Загружаем партии"
          description="Получаем историю партий."
        />
      ) : null}
      {result.error ? (
        <ErrorState description={result.error} onRetry={result.reload} />
      ) : null}
      {result.data && !result.data.data.length ? (
        <EmptyState
          icon={History}
          title="История партий пуста"
          description="Добавьте первую партию: дата, игроки, результат и заметки сохранятся в PlaySession."
          action={
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <CalendarPlus className="h-4 w-4" /> Добавить партию
            </Button>
          }
        />
      ) : null}
      {result.data?.data.length ? (
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 text-sm font-medium">
            {result.data.pagination.total} записей
          </div>
          <div className="divide-y">
            {result.data.data.map((play) => (
              <PlayRow
                key={play.id}
                play={play}
                onEdit={() => {
                  setEditing(play);
                  setDialogOpen(true);
                }}
                onDelete={() => remove(play)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {result.data && result.data.pagination.totalPages > 1 ? (
        <Pagination
          page={result.data.pagination.page}
          totalPages={result.data.pagination.totalPages}
          createHref={(page) => {
            const next = new URLSearchParams(searchParams.toString());
            if (page <= 1) next.delete("page");
            else next.set("page", String(page));
            return playsHref(next);
          }}
        />
      ) : null}

      {dialogOpen ? (
        <AddPlayDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          initialItemId={editing?.item.id ?? initialItemId}
          initialItemTitle={editing?.item.title}
          editingPlay={editing}
          onSaved={result.reload}
        />
      ) : null}
    </main>
  );
}

function PlayRow({
  play,
  onEdit,
  onDelete,
}: {
  play: PlayListItemDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[72px_9rem_minmax(0,1fr)_auto] md:items-center">
      <GameCover
        src={play.item.cover?.url ?? play.item.cover?.path}
        alt={play.item.title}
        size="sm"
      />
      <div>
        <div className="font-medium">{formatDate(play.playedAt)}</div>
        <div className="text-xs text-muted-foreground">
          {play.startedAt
            ? `Начало ${new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(play.startedAt))}`
            : play.source === "boardgamegeek"
              ? "BGG"
              : "Ручная запись"}
        </div>
      </div>
      <div className="min-w-0">
        <Link
          href={`/collection/${play.item.id}?tab=plays`}
          className="font-medium hover:underline"
        >
          {play.item.title}
        </Link>
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {play.playersCount ? <span>{play.playersCount} игроков</span> : null}
          {play.durationMinutes ? (
            <span>{play.durationMinutes} минут</span>
          ) : null}
          {play.score ? <span>Счёт {play.score}</span> : null}
          {play.personalRating ? (
            <span>Оценка {play.personalRating}/10</span>
          ) : null}
          {play.scenario ? <span>{play.scenario}</span> : null}
        </div>
        {play.notes ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {play.notes}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {play.result ? (
          <Badge variant="secondary">{resultLabel(play.result)}</Badge>
        ) : null}
        {play.source === "manual" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onEdit}
              aria-label="Редактировать партию"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onDelete}
              aria-label="Удалить партию"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Badge variant="outline">Только чтение</Badge>
        )}
      </div>
    </article>
  );
}

function SelectFilter({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={`plays-${name}`}>{label}</Label>
      <Dropdown
        id={`plays-${name}`}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {children}
      </Dropdown>
    </div>
  );
}
function NumberRange({
  label,
  nameMin,
  nameMax,
  min,
  defaultMin,
  defaultMax,
}: {
  label: string;
  nameMin: string;
  nameMax: string;
  min: number;
  defaultMin?: number;
  defaultMax?: number;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input
          aria-label={`${label}: от`}
          name={nameMin}
          type="number"
          min={min}
          defaultValue={defaultMin ?? ""}
          placeholder="От"
        />
        <Input
          aria-label={`${label}: до`}
          name={nameMax}
          type="number"
          min={min}
          defaultValue={defaultMax ?? ""}
          placeholder="До"
        />
      </div>
    </fieldset>
  );
}
export function playsQueryFromUrl(
  params: URLSearchParams,
  initialItemId?: string,
): PlaysListQuery {
  const page = Number(params.get("page") ?? 1);
  const result = params.get("result") as PlayResult | null;
  const source = params.get("source");
  return {
    itemId: params.get("itemId") || initialItemId || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    result: result || undefined,
    player: params.get("player") || params.get("playerName") || undefined,
    playersMin: optionalPositiveNumber(params, "playersMin"),
    playersMax: optionalPositiveNumber(params, "playersMax"),
    durationMin: optionalNonNegativeNumber(params, "durationMin"),
    durationMax: optionalNonNegativeNumber(params, "durationMax"),
    usedItemId: params.get("usedItemId") || undefined,
    source:
      source === "manual" || source === "boardgamegeek" ? source : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 24,
  };
}
export function playsHref(params: URLSearchParams) {
  const value = params.toString();
  return value ? `/plays?${value}` : "/plays";
}
function optionalPositiveNumber(params: URLSearchParams, key: string) {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
function optionalNonNegativeNumber(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
function resultLabel(result: PlayResult) {
  return (
    {
      win: "Победа",
      loss: "Поражение",
      score: "Счёт",
      unknown: "Неизвестно",
    } satisfies Record<PlayResult, string>
  )[result];
}
