"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Edit3,
  History,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast-provider";
import {
  apiClient,
  type CreatePlaySessionRequest,
  type ItemListDto,
  type PlayResult,
  type PlaySessionDto,
  type PlaysQuery,
} from "@/shared/api";

const ALL_VALUE = "__all__";
const NONE_VALUE = "__none__";

type PlaysPageClientProps = {
  initialItemId?: string;
};

type PlayFormState = {
  itemId: string;
  playedAt: string;
  playersCount: string;
  durationMinutes: string;
  result: PlayResult | typeof NONE_VALUE;
  score: string;
  scenario: string;
  playerNames: string;
  usedItemIds: string[];
  notes: string;
};

const emptyForm: PlayFormState = {
  itemId: "",
  playedAt: toDateInputValue(new Date().toISOString()),
  playersCount: "",
  durationMinutes: "",
  result: NONE_VALUE,
  score: "",
  scenario: "",
  playerNames: "",
  usedItemIds: [],
  notes: "",
};

export function PlaysPageClient({ initialItemId }: PlaysPageClientProps) {
  const { toast } = useToast();
  const [plays, setPlays] = React.useState<PlaySessionDto[]>([]);
  const [collectionItems, setCollectionItems] = React.useState<ItemListDto[]>(
    [],
  );
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(Boolean(initialItemId));
  const [editingPlay, setEditingPlay] = React.useState<PlaySessionDto | null>(
    null,
  );
  const [filters, setFilters] = React.useState({
    itemId: initialItemId ?? ALL_VALUE,
    from: "",
    to: "",
    source: ALL_VALUE,
  });
  const [appliedFilters, setAppliedFilters] = React.useState(filters);
  const [form, setForm] = React.useState<PlayFormState>({
    ...emptyForm,
    itemId: initialItemId ?? "",
  });

  React.useEffect(() => {
    let isActive = true;

    Promise.all([
      apiClient.plays.list({
        ...toPlaysQuery(appliedFilters),
        pageSize: 100,
      }),
      apiClient.collection.list({ pageSize: 100 }),
    ])
      .then(([playsResponse, collectionResponse]) => {
        if (!isActive) {
          return;
        }

        setPlays(playsResponse.data);
        setTotal(playsResponse.pagination.total);
        setCollectionItems(collectionResponse.data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить партии",
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

  function reload() {
    setLoading(true);
    setAppliedFilters((current) => ({ ...current }));
  }

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
      itemId: ALL_VALUE,
      from: "",
      to: "",
      source: ALL_VALUE,
    };
    setFilters(nextFilters);
    setLoading(true);
    setError(null);
    setAppliedFilters(nextFilters);
  }

  function openCreateDialog() {
    setEditingPlay(null);
    setForm({
      ...emptyForm,
      itemId: filters.itemId !== ALL_VALUE ? filters.itemId : "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(play: PlaySessionDto) {
    setEditingPlay(play);
    setForm({
      itemId: play.itemId,
      playedAt: toDateInputValue(play.playedAt),
      playersCount: play.playersCount ? String(play.playersCount) : "",
      durationMinutes: play.durationMinutes ? String(play.durationMinutes) : "",
      result: play.result ?? NONE_VALUE,
      score: play.score ?? "",
      scenario: play.scenario ?? "",
      playerNames: play.playerNames.join(", "),
      usedItemIds: play.usedItemIds,
      notes: play.notes ?? "",
    });
    setDialogOpen(true);
  }

  function updateForm<K extends keyof PlayFormState>(
    key: K,
    value: PlayFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleUsedItem(itemId: string) {
    setForm((current) => ({
      ...current,
      usedItemIds: current.usedItemIds.includes(itemId)
        ? current.usedItemIds.filter((id) => id !== itemId)
        : [...current.usedItemIds, itemId],
    }));
  }

  async function savePlay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.itemId) {
      toast({
        title: "Выберите игру",
        description: "Партия должна быть привязана к Item.",
        variant: "error",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = toPlayRequest(form);

      if (editingPlay) {
        await apiClient.plays.update(editingPlay.id, payload);
      } else {
        await apiClient.plays.create(form.itemId, payload);
      }

      toast({
        title: editingPlay ? "Партия обновлена" : "Партия добавлена",
        description: "История и агрегаты коллекции обновятся при загрузке.",
        variant: "success",
      });
      setDialogOpen(false);
      setLoading(true);
      setAppliedFilters((current) => ({ ...current }));
    } catch (saveError) {
      toast({
        title: "Не удалось сохранить партию",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Проверьте поля и попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlay(play: PlaySessionDto) {
    if (!window.confirm(`Удалить партию ${formatDate(play.playedAt)}?`)) {
      return;
    }

    try {
      await apiClient.plays.delete(play.id);
      toast({
        title: "Партия удалена",
        variant: "success",
      });
      setLoading(true);
      setAppliedFilters((current) => ({ ...current }));
    } catch (deleteError) {
      toast({
        title: "Не удалось удалить партию",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Попробуйте еще раз.",
        variant: "error",
      });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Партии</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            История партий, быстрый ввод и редактирование локальных записей.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <CalendarPlus className="h-4 w-4" />
          Добавить партию
        </Button>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1.4fr_repeat(3,1fr)_auto]"
      >
        <div>
          <Label>Игра</Label>
          <Select
            value={filters.itemId}
            onValueChange={(value) => updateFilter("itemId", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Все игры</SelectItem>
              {collectionItems.map((entry) => (
                <SelectItem key={entry.item.id} value={entry.item.id}>
                  {entry.item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="plays-from">С даты</Label>
          <Input
            id="plays-from"
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter("from", event.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="plays-to">По дату</Label>
          <Input
            id="plays-to"
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label>Источник</Label>
          <Select
            value={filters.source}
            onValueChange={(value) => updateFilter("source", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Все</SelectItem>
              <SelectItem value="manual">Ручные</SelectItem>
              <SelectItem value="boardgamegeek">BGG</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit">Показать</Button>
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
          title="Загружаем партии"
          description="Получаем историю партий."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : plays.length === 0 ? (
        <EmptyState
          icon={History}
          title="История партий пуста"
          description="Добавьте первую партию: дата, игроки, результат и заметки сохранятся в PlaySession."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <CalendarPlus className="h-4 w-4" />
              Добавить партию
            </Button>
          }
        />
      ) : (
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="text-sm font-medium">{total} записей</div>
            <div className="text-xs text-muted-foreground">
              Показано {plays.length}
            </div>
          </div>
          <div className="divide-y">
            {plays.map((play) => (
              <PlayRow
                key={play.id}
                play={play}
                onEdit={openEditDialog}
                onDelete={deletePlay}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlay ? "Редактировать партию" : "Добавить партию"}
            </DialogTitle>
            <DialogDescription>
              Запись сохраняется как PlaySession и сразу попадает в историю.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={savePlay} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Игра</Label>
              <Select
                value={form.itemId || undefined}
                onValueChange={(value) => updateForm("itemId", value)}
                disabled={Boolean(editingPlay)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Выберите игру" />
                </SelectTrigger>
                <SelectContent>
                  {collectionItems.map((entry) => (
                    <SelectItem key={entry.item.id} value={entry.item.id}>
                      {entry.item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="play-date">Дата</Label>
              <Input
                id="play-date"
                type="date"
                value={form.playedAt}
                onChange={(event) => updateForm("playedAt", event.target.value)}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="play-players-count">Количество игроков</Label>
              <Input
                id="play-players-count"
                type="number"
                min={1}
                value={form.playersCount}
                onChange={(event) =>
                  updateForm("playersCount", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="play-duration">Длительность, минут</Label>
              <Input
                id="play-duration"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(event) =>
                  updateForm("durationMinutes", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label>Результат</Label>
              <Select
                value={form.result}
                onValueChange={(value) =>
                  updateForm("result", value as PlayFormState["result"])
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Не указан</SelectItem>
                  <SelectItem value="win">Победа</SelectItem>
                  <SelectItem value="loss">Поражение</SelectItem>
                  <SelectItem value="score">Счет</SelectItem>
                  <SelectItem value="unknown">Неизвестно</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="play-score">Счет</Label>
              <Input
                id="play-score"
                value={form.score}
                onChange={(event) => updateForm("score", event.target.value)}
                className="mt-2"
                placeholder="74:61"
              />
            </div>

            <div>
              <Label htmlFor="play-scenario">Сценарий / сложность</Label>
              <Input
                id="play-scenario"
                value={form.scenario}
                onChange={(event) => updateForm("scenario", event.target.value)}
                className="mt-2"
                placeholder="Сценарий 3, сложность 4"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="play-player-names">Игроки</Label>
              <Input
                id="play-player-names"
                value={form.playerNames}
                onChange={(event) =>
                  updateForm("playerNames", event.target.value)
                }
                className="mt-2"
                placeholder="Имена через запятую"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Использованные дополнения</Label>
              <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {collectionItems
                  .filter((entry) => entry.item.id !== form.itemId)
                  .map((entry) => (
                    <label
                      key={entry.item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.usedItemIds.includes(entry.item.id)}
                        onChange={() => toggleUsedItem(entry.item.id)}
                        className="h-4 w-4 rounded border"
                      />
                      <span className="min-w-0 truncate">
                        {entry.item.title}
                      </span>
                    </label>
                  ))}
                {collectionItems.length <= 1 ? (
                  <div className="text-sm text-muted-foreground">
                    Дополнений в коллекции пока нет.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="play-notes">Заметки</Label>
              <Textarea
                id="play-notes"
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-2"
                placeholder="Комментарий к партии"
              />
            </div>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Сохраняем" : "Сохранить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlayRow({
  play,
  onEdit,
  onDelete,
}: {
  play: PlaySessionDto;
  onEdit: (play: PlaySessionDto) => void;
  onDelete: (play: PlaySessionDto) => void;
}) {
  return (
    <article className="grid gap-3 px-4 py-3 md:grid-cols-[10rem_1fr_auto] md:items-center">
      <div>
        <div className="font-medium">{formatDate(play.playedAt)}</div>
        <div className="text-xs text-muted-foreground">
          {play.source === "boardgamegeek" ? "BGG" : "Ручная запись"}
        </div>
      </div>

      <div className="min-w-0">
        <Link
          href={`/collection/${play.itemId}`}
          className="font-medium hover:underline"
        >
          {play.itemTitle}
        </Link>
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {play.playersCount ? <span>{play.playersCount} игроков</span> : null}
          {play.durationMinutes ? (
            <span>{play.durationMinutes} минут</span>
          ) : null}
          {play.score ? <span>Счет {play.score}</span> : null}
          {play.scenario ? <span>{play.scenario}</span> : null}
        </div>
        {play.notes ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {play.notes}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        {play.result ? (
          <Badge variant="secondary">{resultLabel(play.result)}</Badge>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onEdit(play)}
          title="Редактировать партию"
        >
          <Edit3 className="h-4 w-4" />
          <span className="sr-only">Редактировать партию</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onDelete(play)}
          title="Удалить партию"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Удалить партию</span>
        </Button>
      </div>
    </article>
  );
}

function toPlaysQuery(filters: Record<string, string>): PlaysQuery {
  return {
    itemId: filters.itemId === ALL_VALUE ? undefined : filters.itemId,
    from: filters.from || undefined,
    to: filters.to || undefined,
    source:
      filters.source === "manual" || filters.source === "boardgamegeek"
        ? filters.source
        : undefined,
  };
}

function toPlayRequest(form: PlayFormState): CreatePlaySessionRequest {
  return {
    playedAt: new Date(form.playedAt).toISOString(),
    playersCount: optionalPositiveNumber(form.playersCount),
    durationMinutes: optionalPositiveNumber(form.durationMinutes),
    result: form.result === NONE_VALUE ? null : form.result,
    score: nullableText(form.score),
    scenario: nullableText(form.scenario),
    playerNames: parseCommaList(form.playerNames),
    usedItemIds: form.usedItemIds,
    notes: nullableText(form.notes),
  };
}

function optionalPositiveNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateInputValue(value: string) {
  return value.slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function resultLabel(result: PlayResult) {
  const labels: Record<PlayResult, string> = {
    win: "Победа",
    loss: "Поражение",
    score: "Счет",
    unknown: "Неизвестно",
  };

  return labels[result];
}
