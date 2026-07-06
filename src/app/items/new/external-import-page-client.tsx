"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";

import { EmptyState, ErrorState } from "@/components/ui-state";
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
  apiClient,
  type ExternalSearchResultDto,
  type ImportExternalItemRequest,
} from "@/shared/api";

const ANY_VALUE = "__any__";

const itemTypeOptions = [
  { value: ANY_VALUE, label: "Все типы" },
  { value: "base_game", label: "Игры" },
  { value: "expansion", label: "Дополнения" },
  { value: "accessory", label: "Аксессуары" },
];

const targetOptions = [
  { value: "collection", label: "В коллекцию", icon: Boxes },
  { value: "wishlist", label: "В wishlist", icon: Star },
  { value: "reference_only", label: "Только справка", icon: Download },
] satisfies {
  value: NonNullable<ImportExternalItemRequest["target"]>;
  label: string;
  icon: typeof Boxes;
}[];

type ExternalImportPageClientProps = {
  initialTarget?: NonNullable<ImportExternalItemRequest["target"]>;
};

export function ExternalImportPageClient({
  initialTarget = "collection",
}: ExternalImportPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState(ANY_VALUE);
  const [target, setTarget] =
    React.useState<NonNullable<ImportExternalItemRequest["target"]>>(
      initialTarget,
    );
  const [results, setResults] = React.useState<ExternalSearchResultDto[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function searchItems(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Введите название, BGG ID или ссылку на BoardGameGeek");
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.externalSearch.search({
        q: trimmedQuery,
        provider: "boardgamegeek",
        type: type === ANY_VALUE ? undefined : type,
      });
      setResults(response.data);
      setSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Не удалось выполнить внешний поиск",
      );
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function importItem(result: ExternalSearchResultDto) {
    setImportingId(result.externalId);
    setError(null);

    try {
      const details = await apiClient.externalSearch.import({
        provider: result.provider,
        externalId: result.externalId,
        target,
      });

      if (target === "collection") {
        router.push(`/collection/${details.item.id}`);
        return;
      }

      if (target === "wishlist") {
        router.push(`/wishlist/${details.item.id}`);
        return;
      }

      setQuery(result.title);
      setResults([result]);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Не удалось импортировать игру",
      );
    } finally {
      setImportingId(null);
    }
  }

  function reset() {
    setQuery("");
    setType(ANY_VALUE);
    setResults([]);
    setSearched(false);
    setError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">
          Добавить игру
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Поиск во внешнем каталоге и импорт справочных данных.
        </p>
      </div>

      <form
        onSubmit={searchItems}
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(16rem,1fr)_12rem_13rem_auto]"
      >
        <div>
          <Label htmlFor="external-search">Название или ссылка</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="external-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Ark Nova или BGG URL"
            />
          </div>
        </div>

        <div>
          <Label>Тип</Label>
          <Select value={type} onValueChange={setType}>
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
          <Label>Цель импорта</Label>
          <Select
            value={target}
            onValueChange={(value) =>
              setTarget(
                value as NonNullable<ImportExternalItemRequest["target"]>,
              )
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading} className="min-w-28">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Найти
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={reset}
            title="Сбросить"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Сбросить</span>
          </Button>
        </div>
      </form>

      {error ? <ErrorState description={error} /> : null}

      {!searched && !error ? (
        <EmptyState
          icon={Search}
          title="Начните с поиска"
          description="Введите название игры, внешний ID или ссылку на страницу BoardGameGeek."
        />
      ) : null}

      {searched && !loading && results.length === 0 && !error ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="Попробуйте другое название или вставьте прямую ссылку на BoardGameGeek."
        />
      ) : null}

      {results.length > 0 ? (
        <section className="grid gap-3">
          {results.map((result) => (
            <SearchResultRow
              key={`${result.provider}:${result.externalId}`}
              result={result}
              target={target}
              importing={importingId === result.externalId}
              onImport={() => importItem(result)}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}

function SearchResultRow({
  result,
  target,
  importing,
  onImport,
}: {
  result: ExternalSearchResultDto;
  target: NonNullable<ImportExternalItemRequest["target"]>;
  importing: boolean;
  onImport: () => void;
}) {
  const TargetIcon =
    targetOptions.find((option) => option.value === target)?.icon ?? Download;

  return (
    <article className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-normal">
            {result.title}
          </h2>
          {result.year ? <Badge variant="secondary">{result.year}</Badge> : null}
          <Badge variant="outline">{providerLabel(result.provider)}</Badge>
          {result.itemTypeCode ? (
            <Badge variant="outline">{itemTypeLabel(result.itemTypeCode)}</Badge>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>ID {result.externalId}</span>
          {result.url ? (
            <Link
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              Открыть источник
            </Link>
          ) : null}
        </div>

        {result.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {result.description}
          </p>
        ) : null}
      </div>

      <Button type="button" onClick={onImport} disabled={importing}>
        {importing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <TargetIcon className="h-4 w-4" />
        )}
        Импорт
      </Button>
    </article>
  );
}

function providerLabel(provider: ExternalSearchResultDto["provider"]) {
  if (provider === "boardgamegeek") {
    return "BGG";
  }

  return provider;
}

function itemTypeLabel(itemTypeCode: NonNullable<ExternalSearchResultDto["itemTypeCode"]>) {
  const labels: Record<typeof itemTypeCode, string> = {
    base_game: "Игра",
    expansion: "Дополнение",
    promo: "Промо",
    accessory: "Аксессуар",
    organizer: "Органайзер",
    component: "Компонент",
    miniature: "Миниатюра",
    playmat: "Коврик",
    sleeves: "Протекторы",
    dice: "Кубики",
    other: "Другое",
  };

  return labels[itemTypeCode];
}
