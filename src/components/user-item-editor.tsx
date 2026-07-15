"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { useToast } from "@/components/toast-provider";
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
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  itemStatuses,
  type ItemStatus,
  type TagDto,
  type UserItemDto,
} from "@/shared/api";

const NO_RATING = "__none__";
const NO_INTEREST = "__none__";

type UserItemEditorProps = {
  userItem: UserItemDto;
  onUserItemChange: (userItem: UserItemDto) => void;
  isEditing?: boolean;
};

type UserItemFormState = {
  owned: boolean;
  wishlist: boolean;
  status: ItemStatus;
  location: string;
  personalRating: string;
  notes: string;
  interestLevel: string;
  decisionNotes: string;
  tags: string;
};

export function UserItemEditor({
  userItem,
  onUserItemChange,
  isEditing = true,
}: UserItemEditorProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(() => toUserItemForm(userItem));

  if (!isEditing) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Моя коллекция
        </h2>
        <dl className="mt-5 grid gap-4 text-sm">
          <ReadOnlyRow label="Статус" value={statusLabel(userItem.status)} />
          <ReadOnlyRow
            label="Место хранения"
            value={userItem.location ?? "Не указано"}
          />
          <ReadOnlyRow
            label="Личная оценка"
            value={
              userItem.personalRating
                ? `${userItem.personalRating}/10`
                : "Без оценки"
            }
          />
          <ReadOnlyRow
            label="Интерес"
            value={
              userItem.interestLevel
                ? `${userItem.interestLevel}/5`
                : "Не указан"
            }
          />
          <ReadOnlyRow
            label="Теги"
            value={
              userItem.tags.length
                ? userItem.tags.map((tag) => tag.name).join(", ")
                : "Нет"
            }
          />
        </dl>
        {userItem.notes ? (
          <div className="mt-5 border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Заметки владельца
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {userItem.notes}
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  function updateForm<K extends keyof UserItemFormState>(
    key: K,
    value: UserItemFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveUserItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const tagIds = await resolveTagIds(form.tags);
      const updated = await apiClient.items.updateUserItem(userItem.itemId, {
        owned: form.owned,
        wishlist: form.wishlist,
        status: form.status,
        location: nullableText(form.location),
        personalRating:
          form.personalRating === NO_RATING
            ? null
            : Number(form.personalRating),
        notes: nullableText(form.notes),
        interestLevel:
          form.interestLevel === NO_INTEREST
            ? null
            : Number(form.interestLevel),
        decisionNotes: nullableText(form.decisionNotes),
        tagIds,
      });

      setForm(toUserItemForm(updated));
      onUserItemChange(updated);
      toast({
        title: "Состояние сохранено",
        description: "Owned, wishlist, статус, заметки и теги обновлены.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Не удалось сохранить",
        description:
          error instanceof Error
            ? error.message
            : "Проверьте поля и попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveUserItem} className="rounded-lg border bg-card p-4">
      <h2 className="text-base font-semibold">Пользовательское состояние</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.owned}
            onChange={(event) => updateForm("owned", event.target.checked)}
            className="h-4 w-4 rounded border"
          />
          <span>В коллекции</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.wishlist}
            onChange={(event) => updateForm("wishlist", event.target.checked)}
            className="h-4 w-4 rounded border"
          />
          <span>В wishlist</span>
        </label>
      </div>

      <div className="mt-4">
        <Label>Статус</Label>
        <Select
          value={form.status}
          onValueChange={(value) => updateForm("status", value as ItemStatus)}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itemStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <Label htmlFor="user-item-location">Место хранения</Label>
        <Input
          id="user-item-location"
          value={form.location}
          onChange={(event) => updateForm("location", event.target.value)}
          className="mt-2"
          placeholder="Шкаф, полка, коробка"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Личная оценка</Label>
          <Select
            value={form.personalRating}
            onValueChange={(value) => updateForm("personalRating", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RATING}>Без оценки</SelectItem>
              {Array.from({ length: 10 }, (_, index) => {
                const value = String(10 - index);
                return (
                  <SelectItem key={value} value={value}>
                    {value}/10
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Интерес</Label>
          <Select
            value={form.interestLevel}
            onValueChange={(value) => updateForm("interestLevel", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INTEREST}>Не указан</SelectItem>
              {Array.from({ length: 5 }, (_, index) => {
                const value = String(5 - index);
                return (
                  <SelectItem key={value} value={value}>
                    {value}/5
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="user-item-tags">Теги</Label>
        <Input
          id="user-item-tags"
          value={form.tags}
          onChange={(event) => updateForm("tags", event.target.value)}
          className="mt-2"
          placeholder="Соло, семейная, кампания"
        />
      </div>

      <div className="mt-4">
        <Label htmlFor="user-item-notes">Заметки владельца</Label>
        <Textarea
          id="user-item-notes"
          value={form.notes}
          onChange={(event) => updateForm("notes", event.target.value)}
          className="mt-2"
        />
      </div>

      <div className="mt-4">
        <Label htmlFor="user-item-decision-notes">Заметки к решению</Label>
        <Textarea
          id="user-item-decision-notes"
          value={form.decisionNotes}
          onChange={(event) => updateForm("decisionNotes", event.target.value)}
          className="mt-2"
        />
      </div>

      <Button type="submit" className="mt-5 w-full" disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? "Сохраняем" : "Сохранить состояние"}
      </Button>
    </form>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function toUserItemForm(userItem: UserItemDto): UserItemFormState {
  return {
    owned: userItem.owned,
    wishlist: userItem.wishlist,
    status: userItem.status,
    location: userItem.location ?? "",
    personalRating: userItem.personalRating
      ? String(userItem.personalRating)
      : NO_RATING,
    notes: userItem.notes ?? "",
    interestLevel: userItem.interestLevel
      ? String(userItem.interestLevel)
      : NO_INTEREST,
    decisionNotes: userItem.decisionNotes ?? "",
    tags: userItem.tags.map((tag) => tag.name).join(", "),
  };
}

async function resolveTagIds(value: string) {
  const names = parseTagNames(value);

  if (names.length === 0) {
    return [];
  }

  const existingTags = await apiClient.tags.list();
  const tagsByName = new Map(
    existingTags.map((tag) => [tag.name.toLowerCase(), tag]),
  );
  const resolvedTags: TagDto[] = [];

  for (const name of names) {
    const existingTag = tagsByName.get(name.toLowerCase());

    if (existingTag) {
      resolvedTags.push(existingTag);
      continue;
    }

    const createdTag = await apiClient.tags.create({ name });
    tagsByName.set(createdTag.name.toLowerCase(), createdTag);
    resolvedTags.push(createdTag);
  }

  return resolvedTags.map((tag) => tag.id);
}

function parseTagNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function statusLabel(status: ItemStatus) {
  const labels: Record<ItemStatus, string> = {
    owned: "В коллекции",
    wishlist: "Wishlist",
    preordered: "Предзаказ",
    played: "Сыграно",
    for_sale: "На продажу",
    sold: "Продано",
    archived: "Архив",
  };

  return labels[status];
}
