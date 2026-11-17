"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import {
  searchPreorderGames,
  type PreorderGame,
} from "@/features/preorders/game-search";
import type { ExternalSearchResultDto } from "@/shared/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function PreorderGameSearch({
  onSelectExisting,
  onSelectExternal,
  onManualQueryChange,
}: {
  onSelectExisting: (game: PreorderGame) => void;
  onSelectExternal: (game: ExternalSearchResultDto) => void;
  onManualQueryChange: (query: string | null) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<Awaited<
    ReturnType<typeof searchPreorderGames>
  > | null>(null);
  const [searchedQuery, setSearchedQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestId = React.useRef(0);
  React.useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  async function search(page = 1, external = false) {
    const current = ++requestId.current;
    const text = query.trim();
    onManualQueryChange(null);
    setResult(null);
    setError("");
    if (!text) {
      setError("Введите название игры");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await searchPreorderGames(text, page, external);
      if (current !== requestId.current) return;
      setResult(next);
      setSearchedQuery(text);
      if (next.data.length === 0) onManualQueryChange(text);
    } catch (error) {
      if (current !== requestId.current) return;
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось найти игру. Повторите поиск.",
      );
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        className="flex items-end gap-3"
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="preorder-game-search">Поиск игры</Label>
          <Input
            id="preorder-game-search"
            className="mt-2"
            value={query}
            placeholder="Название игры"
            onChange={(event) => {
              setQuery(event.target.value);
              requestId.current += 1;
              setResult(null);
              setLoading(false);
              setError("");
              onManualQueryChange(null);
            }}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Search aria-hidden="true" className="h-4 w-4" />
          )}
          {loading ? "Ищем…" : "Найти"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {result?.source === "local" ? (
        <div className="grid gap-3">
          <h2 className="font-semibold">Игры в базе</h2>
          {result.data.map((game) => (
            <Button
              key={game.id}
              type="button"
              variant="outline"
              className="h-auto justify-start whitespace-normal py-3 text-left"
              onClick={() => onSelectExisting(game)}
            >
              {game.title} · {game.type.name}
            </Button>
          ))}
          {result.pagination.totalPages > 1 ? (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={loading || result.pagination.page <= 1}
                onClick={() => void search(result.pagination.page - 1)}
              >
                Назад
              </Button>
              <span>
                {result.pagination.page} / {result.pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={
                  loading ||
                  result.pagination.page >= result.pagination.totalPages
                }
                onClick={() => void search(result.pagination.page + 1)}
              >
                Далее
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void search(1, true)}
          >
            Нужной игры нет — искать в BGG
          </Button>
        </div>
      ) : null}
      {result?.source === "external" ? (
        <div className="grid gap-3">
          {result.warnings?.map((warning) => (
            <p
              key={warning.code}
              role="status"
              className="text-sm text-muted-foreground"
            >
              {warning.message}
            </p>
          ))}
          {result.data.length > 0 ? (
            <>
              <h2 className="font-semibold">Игры в BoardGameGeek</h2>
              {result.data.map((game) => (
                <Button
                  key={`${game.provider}:${game.externalId}`}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                  onClick={() => onSelectExternal(game)}
                >
                  {game.title}
                  {game.year ? ` (${game.year})` : ""}
                </Button>
              ))}
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              «{searchedQuery}» не найдена в базе и BGG. Заполните данные игры
              ниже.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
