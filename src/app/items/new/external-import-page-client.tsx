"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Download,
  ExternalLink,
  Loader2,
  PenLine,
  PlusCircle,
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
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type CreateItemRequest,
  type ExternalSearchResultDto,
  type ImportExternalItemRequest,
  type ItemTypeDto,
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
  const [itemTypes, setItemTypes] = React.useState<ItemTypeDto[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [showManualForm, setShowManualForm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manualMessage, setManualMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.itemTypes
      .list()
      .then(setItemTypes)
      .catch(() => {
        setError("Не удалось загрузить типы игр для ручного добавления");
      });
  }, []);

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
      setShowManualForm(response.data.length === 0);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Не удалось выполнить внешний поиск",
      );
      setResults([]);
      setSearched(true);
      setShowManualForm(true);
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
    setShowManualForm(false);
    setError(null);
    setManualMessage(null);
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

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            Добавить вручную
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Если BGG недоступен или не нашел игру, заполните карточку сами.
          </p>
        </div>
        <Button
          type="button"
          variant={showManualForm ? "secondary" : "outline"}
          onClick={() => setShowManualForm((value) => !value)}
        >
          <PenLine className="h-4 w-4" />
          {showManualForm ? "Скрыть форму" : "Ручной ввод"}
        </Button>
      </section>

      {showManualForm ? (
        <ManualItemForm
          initialTitle={query}
          itemTypes={itemTypes}
          selectedType={type}
          target={target}
          onError={setError}
          onSavedAsReference={(title) => {
            setManualMessage(`Карточка "${title}" создана вручную.`);
            setError(null);
          }}
        />
      ) : null}

      {manualMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {manualMessage}
        </div>
      ) : null}

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

function ManualItemForm({
  initialTitle,
  itemTypes,
  selectedType,
  target,
  onError,
  onSavedAsReference,
}: {
  initialTitle: string;
  itemTypes: ItemTypeDto[];
  selectedType: string;
  target: NonNullable<ImportExternalItemRequest["target"]>;
  onError: (message: string | null) => void;
  onSavedAsReference: (title: string) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState(initialTitle);
  const [typeId, setTypeId] = React.useState("");
  const [originalTitle, setOriginalTitle] = React.useState("");
  const [year, setYear] = React.useState("");
  const [minPlayers, setMinPlayers] = React.useState("");
  const [maxPlayers, setMaxPlayers] = React.useState("");
  const [minPlayTime, setMinPlayTime] = React.useState("");
  const [maxPlayTime, setMaxPlayTime] = React.useState("");
  const [minAge, setMinAge] = React.useState("");
  const [complexity, setComplexity] = React.useState("");
  const [rating, setRating] = React.useState("");
  const [categories, setCategories] = React.useState("");
  const [mechanics, setMechanics] = React.useState("");
  const [publishers, setPublishers] = React.useState("");
  const [description, setDescription] = React.useState("");
  const defaultTypeId = React.useMemo(() => {
    const selected =
      selectedType === ANY_VALUE
        ? null
        : itemTypes.find((itemType) => itemType.code === selectedType);
    const fallback =
      selected ??
      itemTypes.find((itemType) => itemType.code === "base_game") ??
      itemTypes[0];

    return fallback?.id ?? "";
  }, [itemTypes, selectedType]);
  const selectedTypeId = typeId || defaultTypeId;

  async function saveManualItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      onError("Введите название игры");
      return;
    }

    if (!selectedTypeId) {
      onError("Выберите тип игры");
      return;
    }

    setSaving(true);
    onError(null);

    try {
      const body: CreateItemRequest = {
        typeId: selectedTypeId,
        title: trimmedTitle,
        originalTitle: optionalText(originalTitle),
        description: optionalText(description),
        year: optionalInteger(year),
        minPlayers: optionalInteger(minPlayers),
        maxPlayers: optionalInteger(maxPlayers),
        minPlayTime: optionalInteger(minPlayTime),
        maxPlayTime: optionalInteger(maxPlayTime),
        minAge: optionalInteger(minAge),
        complexity: optionalNumber(complexity),
        rating: optionalNumber(rating),
        sourceMode: "manual",
        categories: splitList(categories),
        mechanics: splitList(mechanics),
        publishers: splitList(publishers),
        designers: [],
        artists: [],
      };
      const details = await apiClient.items.create(body);

      if (target === "collection") {
        const collectionDetails = await apiClient.collection.add(
          details.item.id,
          {},
        );
        router.push(`/collection/${collectionDetails.item.id}`);
        return;
      }

      if (target === "wishlist") {
        await apiClient.wishlist.add(details.item.id);
        router.push(`/wishlist/${details.item.id}`);
        return;
      }

      onSavedAsReference(details.item.title);
    } catch (saveError) {
      onError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось создать игру вручную",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={saveManualItem}
      className="grid gap-4 rounded-lg border bg-card p-4"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_14rem_8rem]">
        <div>
          <Label htmlFor="manual-title">Название</Label>
          <Input
            id="manual-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label>Тип</Label>
          <Select value={selectedTypeId} onValueChange={setTypeId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Выберите тип" />
            </SelectTrigger>
            <SelectContent>
              {itemTypes.map((itemType) => (
                <SelectItem key={itemType.id} value={itemType.id}>
                  {itemType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="manual-year">Год</Label>
          <Input
            id="manual-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="mt-2"
            inputMode="numeric"
            type="number"
            min="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="manual-original-title">Оригинальное название</Label>
        <Input
          id="manual-original-title"
          value={originalTitle}
          onChange={(event) => setOriginalTitle(event.target.value)}
          className="mt-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <NumberField
          id="manual-min-players"
          label="Мин. игроков"
          value={minPlayers}
          onChange={setMinPlayers}
        />
        <NumberField
          id="manual-max-players"
          label="Макс. игроков"
          value={maxPlayers}
          onChange={setMaxPlayers}
        />
        <NumberField
          id="manual-min-time"
          label="Минут от"
          value={minPlayTime}
          onChange={setMinPlayTime}
        />
        <NumberField
          id="manual-max-time"
          label="Минут до"
          value={maxPlayTime}
          onChange={setMaxPlayTime}
        />
        <NumberField
          id="manual-min-age"
          label="Возраст"
          value={minAge}
          onChange={setMinAge}
        />
        <NumberField
          id="manual-rating"
          label="Рейтинг"
          value={rating}
          onChange={setRating}
          step="0.1"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="manual-complexity">Сложность</Label>
          <Input
            id="manual-complexity"
            value={complexity}
            onChange={(event) => setComplexity(event.target.value)}
            className="mt-2"
            inputMode="decimal"
            min="0"
            step="0.1"
            type="number"
          />
        </div>
        <div>
          <Label htmlFor="manual-publishers">Издатели</Label>
          <Input
            id="manual-publishers"
            value={publishers}
            onChange={(event) => setPublishers(event.target.value)}
            className="mt-2"
            placeholder="Через запятую"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="manual-categories">Категории</Label>
          <Input
            id="manual-categories"
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            className="mt-2"
            placeholder="Через запятую"
          />
        </div>
        <div>
          <Label htmlFor="manual-mechanics">Механики</Label>
          <Input
            id="manual-mechanics"
            value={mechanics}
            onChange={(event) => setMechanics(event.target.value)}
            className="mt-2"
            placeholder="Через запятую"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="manual-description">Описание</Label>
        <Textarea
          id="manual-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || itemTypes.length === 0}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step = "1",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min="0"
        step={step}
        type="number"
      />
    </div>
  );
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalInteger(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number.parseInt(trimmed, 10) : null;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function providerLabel(provider: ExternalSearchResultDto["provider"]) {
  if (provider === "boardgamegeek") {
    return "BGG";
  }

  if (provider === "tesera") {
    return "Tesera";
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
