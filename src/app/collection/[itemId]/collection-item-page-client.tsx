"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  ExternalLink,
  Save,
  Star,
} from "lucide-react";

import { ErrorState, LoadingState } from "@/components/ui-state";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast-provider";
import {
  apiClient,
  type CollectionItemDetailsDto,
  type TagDto,
} from "@/shared/api";

const NO_RATING = "__none__";

type CollectionItemPageClientProps = {
  itemId: string;
};

export function CollectionItemPageClient({
  itemId,
}: CollectionItemPageClientProps) {
  const { toast } = useToast();
  const [details, setDetails] = React.useState<CollectionItemDetailsDto | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    owned: true,
    location: "",
    personalRating: NO_RATING,
    notes: "",
    tags: "",
  });

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.collection.get(itemId);
      setDetails(response);
      setForm({
        owned: response.userItem.owned,
        location: response.userItem.location ?? "",
        personalRating: response.userItem.personalRating
          ? String(response.userItem.personalRating)
          : NO_RATING,
        notes: response.userItem.notes ?? "",
        tags: response.userItem.tags.map((tag) => tag.name).join(", "),
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить карточку коллекции",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => {
    let isActive = true;

    apiClient.collection
      .get(itemId)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setDetails(response);
        setForm({
          owned: response.userItem.owned,
          location: response.userItem.location ?? "",
          personalRating: response.userItem.personalRating
            ? String(response.userItem.personalRating)
            : NO_RATING,
          notes: response.userItem.notes ?? "",
          tags: response.userItem.tags.map((tag) => tag.name).join(", "),
        });
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить карточку коллекции",
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
  }, [itemId]);

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveUserItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const tagIds = await resolveTagIds(form.tags);
      const userItem = await apiClient.items.updateUserItem(itemId, {
        owned: form.owned,
        wishlist: details?.userItem.wishlist ?? false,
        location: nullableText(form.location),
        personalRating:
          form.personalRating === NO_RATING
            ? null
            : Number(form.personalRating),
        notes: nullableText(form.notes),
        tagIds,
      });

      setDetails((current) =>
        current
          ? {
              ...current,
              userItem,
            }
          : current,
      );
      setForm((current) => ({
        ...current,
        tags: userItem.tags.map((tag) => tag.name).join(", "),
      }));
      toast({
        title: "Сохранено",
        description: form.owned
          ? "Данные владельца обновлены."
          : "Игра больше не отмечена как owned.",
        variant: "success",
      });
    } catch (saveError) {
      toast({
        title: "Не удалось сохранить",
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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState
          title="Загружаем карточку"
          description="Получаем компактные данные владельца."
        />
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          description={error ?? "Карточка коллекции не найдена"}
          onRetry={loadDetails}
        />
      </main>
    );
  }

  const referenceUrl =
    details.externalReferences.find((reference) => reference.url)?.url ??
    details.links.find((link) => link.type === "official")?.url ??
    null;
  const totalValue = formatPurchases(details.purchases);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/collection">
            <ArrowLeft className="h-4 w-4" />
            Назад к коллекции
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                {details.item.title}
              </h1>
              {details.userItem.owned ? (
                <Badge>Есть</Badge>
              ) : (
                <Badge variant="secondary">Не owned</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{details.item.type.name}</span>
              {details.item.year ? <span>{details.item.year}</span> : null}
              {details.userItem.location ? (
                <span>{details.userItem.location}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/plays?itemId=${encodeURIComponent(itemId)}`}>
                <CalendarPlus className="h-4 w-4" />
                Добавить партию
              </Link>
            </Button>
            {referenceUrl ? (
              <Button asChild variant="outline">
                <a href={referenceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Справочная информация
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <BookOpen className="h-4 w-4" />
                Справочная информация
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Личная оценка"
          value={
            details.userItem.personalRating
              ? `${details.userItem.personalRating}/10`
              : "Нет"
          }
          icon={<Star className="h-4 w-4" />}
        />
        <MetricCard
          label="Последняя партия"
          value={formatDate(details.playSummary.lastPlayedAt)}
        />
        <MetricCard
          label="Всего партий"
          value={String(details.playSummary.playsCount)}
        />
        <MetricCard label="Стоимость" value={totalValue} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Последние партии</h2>
          </div>
          {details.recentPlays.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Партий пока нет.
            </div>
          ) : (
            <div className="divide-y">
              {details.recentPlays.map((play) => (
                <div
                  key={play.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {formatDate(play.playedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {play.playersCount
                        ? `${play.playersCount} игроков`
                        : "Игроки не указаны"}
                      {play.durationMinutes
                        ? `, ${play.durationMinutes} минут`
                        : ""}
                    </div>
                  </div>
                  {play.result ? (
                    <Badge variant="secondary">{play.result}</Badge>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={saveUserItem} className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Данные владельца</h2>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="collection-owned"
              type="checkbox"
              checked={form.owned}
              onChange={(event) => updateForm("owned", event.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="collection-owned">Есть в коллекции</Label>
          </div>

          <div className="mt-4">
            <Label htmlFor="collection-item-location">Место хранения</Label>
            <Input
              id="collection-item-location"
              value={form.location}
              onChange={(event) => updateForm("location", event.target.value)}
              className="mt-2"
              placeholder="Шкаф, полка, коробка"
            />
          </div>

          <div className="mt-4">
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

          <div className="mt-4">
            <Label htmlFor="collection-item-tags">Теги</Label>
            <Input
              id="collection-item-tags"
              value={form.tags}
              onChange={(event) => updateForm("tags", event.target.value)}
              className="mt-2"
              placeholder="Соло, семейная, кампания"
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="collection-item-notes">Заметки</Label>
            <Textarea
              id="collection-item-notes"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className="mt-2"
              placeholder="Личные заметки владельца"
            />
          </div>

          <Button type="submit" className="mt-5 w-full" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Сохраняем" : "Сохранить"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
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

function formatDate(value?: string | null) {
  if (!value) {
    return "Не было";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPurchases(purchases: CollectionItemDetailsDto["purchases"]) {
  if (purchases.length === 0) {
    return "Нет";
  }

  const totals = purchases.reduce<Record<string, number>>(
    (accumulator, item) => {
      accumulator[item.currency] =
        (accumulator[item.currency] ?? 0) + item.totalPrice;
      return accumulator;
    },
    {},
  );

  return Object.entries(totals)
    .map(([currency, amount]) =>
      new Intl.NumberFormat("ru", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount),
    )
    .join(", ");
}
