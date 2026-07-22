"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { collectionRestAdapter } from "@/features/collection/api";
import { createPlay, updatePlay } from "@/features/plays/api";
import type {
  CreatePlaySessionRequest,
  PlayListItemDto,
  PlayResult,
} from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const NONE = "__none__";

type PlayFormState = {
  itemId: string;
  playedAt: string;
  playersCount: string;
  durationMinutes: string;
  result: PlayResult | typeof NONE;
  score: string;
  scenario: string;
  playerNames: string;
  usedItemIds: string[];
  notes: string;
};

type AddPlayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItemId?: string;
  initialItemTitle?: string;
  editingPlay?: PlayListItemDto | null;
  onSaved?: () => void;
};

export function AddPlayDialog({
  open,
  onOpenChange,
  initialItemId,
  initialItemTitle,
  editingPlay,
  onSaved,
}: AddPlayDialogProps) {
  const { toast } = useToast();
  const collection = useAdapterQuery(
    collectionRestAdapter,
    { page: 1, pageSize: 24, sort: "title", direction: "asc" },
    { key: "add-play-collection" },
  );
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<PlayFormState>(() =>
    formFromProps(editingPlay, initialItemId),
  );

  const cards = collection.data?.data ?? [];
  const hasInitialItem = cards.some(({ item }) => item.id === initialItemId);

  function update<K extends keyof PlayFormState>(
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.itemId) {
      toast({ title: "Выберите игру", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = toRequest(form);
      if (editingPlay) await updatePlay(editingPlay.id, payload);
      else await createPlay(form.itemId, payload);
      toast({
        title: editingPlay ? "Партия обновлена" : "Партия добавлена",
        description: "История и агрегаты коллекции обновлены.",
        variant: "success",
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({
        title: "Не удалось сохранить партию",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingPlay ? "Редактировать партию" : "Добавить партию"}
          </DialogTitle>
          <DialogDescription>
            Дата, участники, результат и дополнения сохранятся в истории.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Игра</Label>
              <Select
                value={form.itemId || undefined}
                onValueChange={(value) => update("itemId", value)}
                disabled={Boolean(editingPlay)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue
                    placeholder={
                      collection.isLoading ? "Загружаем коллекцию" : "Выберите игру"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {initialItemId && !hasInitialItem ? (
                    <SelectItem value={initialItemId}>
                      {initialItemTitle ?? "Выбранная игра"}
                    </SelectItem>
                  ) : null}
                  {cards.map(({ item }) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field label="Дата" htmlFor="play-date">
              <Input
                id="play-date"
                type="date"
                value={form.playedAt}
                onChange={(event) => update("playedAt", event.target.value)}
                required
              />
            </Field>
            <Field label="Количество игроков" htmlFor="play-players-count">
              <Input
                id="play-players-count"
                type="number"
                min={1}
                value={form.playersCount}
                onChange={(event) => update("playersCount", event.target.value)}
              />
            </Field>
            <Field label="Длительность, минут" htmlFor="play-duration">
              <Input
                id="play-duration"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(event) => update("durationMinutes", event.target.value)}
              />
            </Field>
            <div>
              <Label>Результат</Label>
              <Select
                value={form.result}
                onValueChange={(value) =>
                  update("result", value as PlayFormState["result"])
                }
              >
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Не указан</SelectItem>
                  <SelectItem value="win">Победа</SelectItem>
                  <SelectItem value="loss">Поражение</SelectItem>
                  <SelectItem value="score">Счёт</SelectItem>
                  <SelectItem value="unknown">Неизвестно</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Счёт" htmlFor="play-score">
              <Input
                id="play-score"
                value={form.score}
                onChange={(event) => update("score", event.target.value)}
                placeholder="74:61"
              />
            </Field>
            <Field label="Сценарий / сложность" htmlFor="play-scenario">
              <Input
                id="play-scenario"
                value={form.scenario}
                onChange={(event) => update("scenario", event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Label htmlFor="play-player-names">Игроки</Label>
              <Input
                id="play-player-names"
                className="mt-2"
                value={form.playerNames}
                onChange={(event) => update("playerNames", event.target.value)}
                placeholder="Имена через запятую"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Использованные дополнения</Label>
              <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {cards
                  .filter(({ item }) => item.id !== form.itemId)
                  .map(({ item }) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.usedItemIds.includes(item.id)}
                        onChange={() => toggleUsedItem(item.id)}
                      />
                      <span className="truncate">{item.title}</span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="play-notes">Заметки</Label>
              <Textarea
                id="play-notes"
                className="mt-2"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Сохраняем" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function formFromProps(
  play?: PlayListItemDto | null,
  initialItemId?: string,
): PlayFormState {
  return {
    itemId: play?.item.id ?? initialItemId ?? "",
    playedAt: (play?.playedAt ?? new Date().toISOString()).slice(0, 10),
    playersCount: play?.playersCount ? String(play.playersCount) : "",
    durationMinutes: play?.durationMinutes ? String(play.durationMinutes) : "",
    result: play?.result ?? NONE,
    score: play?.score ?? "",
    scenario: play?.scenario ?? "",
    playerNames: play?.playerNames.join(", ") ?? "",
    usedItemIds: play?.usedItems.map(({ id }) => id) ?? [],
    notes: play?.notes ?? "",
  };
}

function toRequest(form: PlayFormState): CreatePlaySessionRequest {
  return {
    playedAt: new Date(`${form.playedAt}T12:00:00.000Z`).toISOString(),
    playersCount: positiveNumber(form.playersCount),
    durationMinutes: positiveNumber(form.durationMinutes),
    result: form.result === NONE ? null : form.result,
    score: textOrNull(form.score),
    scenario: textOrNull(form.scenario),
    playerNames: form.playerNames.split(",").map((value) => value.trim()).filter(Boolean),
    usedItemIds: form.usedItemIds,
    notes: textOrNull(form.notes),
  };
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function textOrNull(value: string) {
  return value.trim() || null;
}
