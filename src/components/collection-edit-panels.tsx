"use client";

import * as React from "react";
import { Heart, Save, Tags } from "lucide-react";

import { Rating } from "@/components/rating";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/shared/api/client";
import type {
  CollectionItemDetailDto,
  TagDto,
  UserItemLifecycleStatus,
} from "@/shared/api";

export type CollectionEditMode = "owner" | "reference";

export function CollectionEditPanels({
  details,
  mode,
  open,
  onOpenChange,
  onSaved,
}: {
  details: CollectionItemDetailDto;
  mode: CollectionEditMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (status?: UserItemLifecycleStatus) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {mode === "owner" ? (
          <OwnerDataForm
            details={details}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        ) : (
          <ReferenceDataForm
            details={details}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OwnerDataForm({ details, onOpenChange, onSaved }: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [rating, setRating] = React.useState(
    details.userItem.personalRating ?? 0,
  );
  const [allTags, setAllTags] = React.useState<TagDto[]>(details.userItem.tags);
  const [selectedTagIds, setSelectedTagIds] = React.useState(
    () => new Set(details.userItem.tags.map(({ id }) => id)),
  );

  React.useEffect(() => {
    let active = true;

    apiRequest<TagDto[]>("/api/tags")
      .then((tags) => {
        if (active) setAllTags(tags);
      })
      .catch(() => {
        // Existing tags stay editable even if the optional tag directory fails.
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);

    try {
      await apiRequest(
        `/api/items/${encodeURIComponent(details.item.id)}/user-item`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: form.get("status") as UserItemLifecycleStatus,
            personalRating: rating || null,
            notes: textOrNull(form.get("notes")),
            favorite: form.get("favorite") === "on",
            tagIds: Array.from(selectedTagIds),
          }),
        },
      );
      toast({ title: "Личные данные сохранены", variant: "success" });
      onOpenChange(false);
      onSaved(form.get("status") as UserItemLifecycleStatus);
    } catch (error) {
      toast({
        title: "Не удалось сохранить личные данные",
        description: errorMessage(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать личные данные</DialogTitle>
        <DialogDescription>
          Эти изменения относятся только к вашей коллекции и не меняют
          справочную карточку игры.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="contents">
        <DialogBody className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="owner-availability">Наличие</Label>
              <Input
                id="owner-availability"
                className="mt-2"
                value="В коллекции"
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="owner-status">Статус</Label>
              <select
                id="owner-status"
                name="status"
                defaultValue={details.userItem.lifecycleStatus}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="active">Активна</option>
                <option value="for_sale">На продажу</option>
                <option value="sold">Продана</option>
                <option value="archived">Архивирована</option>
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Личная оценка</legend>
            <RatingSlider value={rating} onChange={setRating} />
          </fieldset>

          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <input
              name="favorite"
              type="checkbox"
              defaultChecked={details.userItem.favorite}
            />
            <Heart className="h-4 w-4 text-[var(--accent-primary-hover)]" />В
            избранном
          </label>

          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-medium">
              <Tags className="h-4 w-4" />
              Пользовательские теги
            </legend>
            {allTags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-[var(--accent-soft)]"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Теги ещё не созданы.
              </p>
            )}
          </fieldset>

          <div>
            <Label htmlFor="owner-notes">Личная заметка</Label>
            <Textarea
              id="owner-notes"
              name="notes"
              className="mt-2 min-h-28"
              defaultValue={details.userItem.notes ?? ""}
              placeholder="Что важно помнить об этой игре?"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Сохраняем" : "Сохранить"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function RatingSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <div className="relative inline-flex min-h-10 items-center">
        <Rating
          value={value / 2}
          tone="accent"
          size="lg"
          label={value ? `Личная оценка: ${value} из 10` : "Без оценки"}
        />
        <input
          aria-label="Личная оценка от 1 до 10"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <span className="min-w-16 text-sm font-medium tabular-nums">
        {value ? `${value} / 10` : "Без оценки"}
      </span>
      {value ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange(0)}
        >
          Очистить
        </Button>
      ) : null}
    </div>
  );
}

function ReferenceDataForm({ details, onOpenChange, onSaved }: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);

    try {
      await apiRequest(`/api/items/${encodeURIComponent(details.item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          originalTitle: textOrNull(form.get("originalTitle")),
          year: numberOrNull(form.get("year")),
          minPlayers: numberOrNull(form.get("minPlayers")),
          maxPlayers: numberOrNull(form.get("maxPlayers")),
          minPlayTime: numberOrNull(form.get("minPlayTime")),
          maxPlayTime: numberOrNull(form.get("maxPlayTime")),
          minAge: numberOrNull(form.get("minAge")),
          complexity: numberOrNull(form.get("complexity")),
          description: textOrNull(form.get("description")),
          categories: listValue(form.get("categories")),
          mechanics: listValue(form.get("mechanics")),
          designers: listValue(form.get("designers")),
          artists: listValue(form.get("artists")),
          publishers: listValue(form.get("publishers")),
        }),
      });
      toast({ title: "Справочные данные сохранены", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "Не удалось сохранить справочные данные",
        description: errorMessage(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать справочные данные</DialogTitle>
        <DialogDescription>
          Название, параметры и авторы относятся к самой игре. Личная оценка и
          заметки здесь не изменяются.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="contents">
        <DialogBody className="grid gap-4">
          <div>
            <Label htmlFor="reference-title">Название</Label>
            <Input
              id="reference-title"
              name="title"
              className="mt-2"
              required
              defaultValue={details.item.title}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="reference-original-title"
              label="Оригинальное название"
              name="originalTitle"
              defaultValue={details.item.originalTitle ?? ""}
            />
            <Field
              id="reference-year"
              label="Год выпуска"
              name="year"
              type="number"
              defaultValue={details.item.year ?? ""}
            />
            <Field
              id="reference-min-players"
              label="Игроков, от"
              name="minPlayers"
              type="number"
              defaultValue={details.item.minPlayers ?? ""}
            />
            <Field
              id="reference-max-players"
              label="Игроков, до"
              name="maxPlayers"
              type="number"
              defaultValue={details.item.maxPlayers ?? ""}
            />
            <Field
              id="reference-min-time"
              label="Минут, от"
              name="minPlayTime"
              type="number"
              defaultValue={details.item.minPlayTime ?? ""}
            />
            <Field
              id="reference-max-time"
              label="Минут, до"
              name="maxPlayTime"
              type="number"
              defaultValue={details.item.maxPlayTime ?? ""}
            />
            <Field
              id="reference-age"
              label="Возраст"
              name="minAge"
              type="number"
              defaultValue={details.item.minAge ?? ""}
            />
            <Field
              id="reference-complexity"
              label="Сложность, 0–5"
              name="complexity"
              type="number"
              step="0.01"
              defaultValue={details.item.complexity ?? ""}
            />
          </div>
          <ListField
            id="reference-categories"
            label="Категории"
            name="categories"
            values={details.item.categories}
          />
          <ListField
            id="reference-mechanics"
            label="Механики"
            name="mechanics"
            values={details.item.mechanics}
          />
          <ListField
            id="reference-designers"
            label="Дизайнеры"
            name="designers"
            values={details.item.designers}
          />
          <ListField
            id="reference-artists"
            label="Художники"
            name="artists"
            values={details.item.artists}
          />
          <ListField
            id="reference-publishers"
            label="Издатели"
            name="publishers"
            values={details.item.publishers}
          />
          <div>
            <Label htmlFor="reference-description">Описание</Label>
            <Textarea
              id="reference-description"
              name="description"
              className="mt-2 min-h-36"
              defaultValue={details.item.description ?? ""}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Сохраняем" : "Сохранить"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="mt-2" {...props} />
    </div>
  );
}

function ListField({
  id,
  label,
  name,
  values,
}: {
  id: string;
  label: string;
  name: string;
  values: { name: string }[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        className="mt-2"
        defaultValue={values.map(({ name: value }) => value).join(", ")}
        placeholder="Значения через запятую"
      />
    </div>
  );
}

type FormProps = {
  details: CollectionItemDetailDto;
  onOpenChange: (open: boolean) => void;
  onSaved: (status?: UserItemLifecycleStatus) => void;
};

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function listValue(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
