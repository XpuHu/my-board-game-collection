"use client";
import * as React from "react";
import { apiRequest } from "@/shared/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type LocalItem = { id: string; title: string; type: { name: string } };
type Result = {
  data: LocalItem[];
  pagination: { page: number; totalPages: number; total: number };
};
export function LocalItemPicker({
  onSelect,
  typeCode,
  excludeIds = [],
}: {
  onSelect: (item: LocalItem) => void;
  typeCode?: "expansion";
  excludeIds?: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  async function search(page = 1) {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await apiRequest<Result>(
          `/api/items/search?q=${encodeURIComponent(query)}&page=${page}${typeCode ? `&type=${typeCode}` : ""}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось найти игру");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">
        {typeCode
          ? "Выбрать сохранённое дополнение"
          : "Выбрать существующую игру"}
      </h2>
      <div className="flex gap-2">
        <Input
          aria-label={
            typeCode ? "Поиск дополнений" : "Поиск среди сохранённых игр"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название сохранённой игры"
        />
        <Button type="button" onClick={() => void search()} disabled={loading}>
          {loading ? "Ищем…" : "Найти"}
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {result?.data
        .filter((item) => !excludeIds.includes(item.id))
        .map((item) => (
          <Button
            type="button"
            key={item.id}
            variant="outline"
            className="justify-start"
            onClick={() => onSelect(item)}
          >
            {item.title} · {item.type.name}
          </Button>
        ))}
      {result && !result.data.length ? (
        <p>
          {typeCode
            ? "Дополнения не найдены. Укажите название нового дополнения ниже."
            : "Сохранённых игр не найдено. Создайте игру вручную ниже."}
        </p>
      ) : null}
      {result && result.pagination.totalPages > 1 ? (
        <div className="flex gap-2">
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
              loading || result.pagination.page >= result.pagination.totalPages
            }
            onClick={() => void search(result.pagination.page + 1)}
          >
            Далее
          </Button>
        </div>
      ) : null}
    </section>
  );
}
