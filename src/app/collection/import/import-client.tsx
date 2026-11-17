"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BggCollectionEntry } from "@/server/application/collection/bgg-import";
type Row = BggCollectionEntry & {
  match: string;
  operationId: string;
  selected: boolean;
  result?: string;
};
const storageKey = "bgc-bgg-collection-draft";
export function BggCollectionImport() {
  const [username, setUsername] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  function restore() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        setUsername(draft.username);
        setRows(draft.rows);
      }
    } catch {
      setError("Не удалось восстановить черновик импорта.");
    }
  }
  function persist(next: Row[]) {
    setRows(next);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ username, rows: next }),
      );
    } catch {
      setError(
        "Не удалось сохранить прогресс в браузере. Не закрывайте страницу до завершения.",
      );
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 2000000) {
      setError("Файл больше 2 МБ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/import/bgg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: await file.text() }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "Не удалось прочитать XML");
      persist(
        data.map((r: BggCollectionEntry & { match: string }) => ({
          ...r,
          operationId: crypto.randomUUID(),
          selected: r.match === "new" || r.match === "existing",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка файла");
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/import/bgg?username=${encodeURIComponent(username)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "Не удалось получить коллекцию");
      persist(
        data.map((r: BggCollectionEntry & { match: string }) => ({
          ...r,
          operationId: crypto.randomUUID(),
          selected:
            r.match !== "owned" &&
            r.match !== "conflict" &&
            r.match !== "possible",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка BGG");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setError("");
    let current = [...rows];
    try {
      for (const row of current) {
        if (!row.selected || row.result === "success") continue;
        const { externalId, title, type, imageUrl, rating } = row;
        const response = await fetch("/api/import/bgg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: row.operationId,
            entry: { externalId, title, type, imageUrl, rating },
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            `${row.title}: ${data.error?.message ?? "ошибка сохранения"}`,
          );
        current = current.map((r) =>
          r.operationId === row.operationId ? { ...r, result: "success" } : r,
        );
        persist(current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-4">
      <Link href="/collection" className="underline">
        ← Коллекция
      </Link>
      <p className="text-sm text-muted-foreground">
        Можно загрузить XML своей коллекции, скачанный из BGG. Личная оценка
        новой игры округляется до целого по шкале приложения 1–10. Существующие
        оценки не меняются.
      </p>
      <label className="grid gap-2">
        BGG XML
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <h1 className="text-2xl font-bold">Импорт коллекции BoardGameGeek</h1>
      <p>
        Импортируются принадлежащие вам игры и дополнения: название, обложка,
        BGG ID и личная оценка новой игры. Существующие оценки, заметки и
        справочные поля сохраняются. Одинаковые названия без общего BGG ID
        требуют ручной проверки; аксессуары и связи дополнений BGG этим импортом
        не определяются.
      </p>
      <label>
        Имя пользователя BGG
        <Input
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <Button variant="outline" disabled={busy} onClick={restore}>
        Восстановить черновик
      </Button>
      <Button
        disabled={busy || !username.trim()}
        onClick={() => void preview()}
      >
        Предварительный просмотр
      </Button>
      <p aria-live="polite">
        Записей: {rows.length} · Успешно:{" "}
        {rows.filter((r) => r.result === "success").length}
      </p>
      <fieldset disabled={busy} className="grid gap-2">
        {rows.map((row) => (
          <label
            key={row.operationId}
            className="flex items-center gap-3 rounded border p-3"
          >
            <input
              type="checkbox"
              checked={row.selected}
              disabled={row.match === "conflict" || row.result === "success"}
              onChange={(e) =>
                persist(
                  rows.map((r) =>
                    r.operationId === row.operationId
                      ? { ...r, selected: e.target.checked }
                      : r,
                  ),
                )
              }
            />
            <span>
              {row.title} ·{" "}
              {row.match === "possible"
                ? "\u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f \u2014 \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0432\u0440\u0443\u0447\u043d\u0443\u044e"
                : row.match === "new"
                  ? "Новая"
                  : row.match === "owned"
                    ? "Уже в коллекции"
                    : row.match === "conflict"
                      ? "Удалённая — конфликт"
                      : "Существующая карточка"}
              {row.result === "success" ? " · Сохранено" : ""}
            </span>
          </label>
        ))}
      </fieldset>
      {rows.length ? (
        <Button
          disabled={
            busy || !rows.some((r) => r.selected && r.result !== "success")
          }
          onClick={() => void apply()}
        >
          {busy ? "Обработка…" : "Импортировать выбранное / продолжить"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <a
        href="https://boardgamegeek.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm underline"
      >
        Данные BoardGameGeek
      </a>
    </main>
  );
}
