"use client";
import { Dropdown } from "@/components/ui/dropdown";
import {
  PreorderDeliveryMethodField,
  PreorderDeliveryCostField,
} from "@/components/preorder-delivery-fields";
import type { PreorderDeliveryMethod } from "@/shared/lib/preorder-delivery";
import { PreorderUrlField } from "@/components/preorder-url-field";
import { PublisherPicker } from "@/components/publisher-picker";
import {
  ExpansionSelection,
  expansionPayload,
  type ExpansionDraft,
} from "@/components/expansion-selection";
import { calendarToIso } from "@/shared/lib/calendar-date";
import { useProductFeatures } from "@/components/product-features-provider";
import { LocalItemPicker } from "@/components/local-item-picker";
import { PreorderGameSearch } from "@/components/preorder-game-search";
import { usePendingCommand } from "@/shared/hooks/use-pending-command";
import { apiRequest } from "@/shared/api/client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Boxes,
  CalendarPlus,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
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
  type AddToCollectionRequest,
  type CreatePreorderRequest,
  type ProviderCode,
  type ExternalSearchResultDto,
  type ExpectedDatePrecision,
  type ItemTypeDto,
} from "@/shared/api";
import {
  addItemToCollection,
  addItemToWishlist,
  createManualItem,
  importExternalItem,
  listItemTypes,
  searchExternalItems,
  updateItemUserData,
  type CreateManualItemRequest,
} from "@/features/items/api";

const ANY_VALUE = "__any__";

type ManualQuickAction =
  "collection" | "play" | "wishlist" | "preorder" | "reference_only";

const itemTypeOptions = [
  { value: ANY_VALUE, label: "Все типы" },
  { value: "base_game", label: "Игры" },
  { value: "expansion", label: "Дополнения" },
  { value: "accessory", label: "Аксессуары" },
];

const targetOptions = [
  { value: "collection", label: "В коллекцию", icon: Boxes },
  { value: "play", label: "Добавить партию", icon: CalendarPlus },
  { value: "wishlist", label: "В wishlist", icon: Star },
  { value: "preorder", label: "Оформить предзаказ", icon: PlusCircle },
  { value: "reference_only", label: "Только справка", icon: Download },
] satisfies {
  value: ManualQuickAction;
  label: string;
  icon: typeof Boxes;
}[];

const quickActionOptions = [
  {
    value: "collection",
    label: "Создать в коллекции",
    description: "Игра появится в коллекции.",
    icon: Boxes,
  },
  {
    value: "play",
    label: "Создать и добавить партию",
    description: "После сохранения откроется форма партии.",
    icon: CalendarPlus,
  },
  {
    value: "wishlist",
    label: "Создать и добавить в wishlist",
    description: "Игра попадет в список будущих покупок.",
    icon: Star,
  },
  {
    value: "preorder",
    label: "Создать и оформить предзаказ",
    description: "После сохранения откроется форма предзаказа.",
    icon: PlusCircle,
  },
  {
    value: "reference_only",
    label: "Создать как справочник",
    description: "Без owned, wishlist и других действий.",
    icon: Download,
  },
] satisfies {
  value: ManualQuickAction;
  label: string;
  description: string;
  icon: typeof Boxes;
}[];

type ExternalImportPageClientProps = {
  initialTarget?: ManualQuickAction;
  initialItemId?: string;
};

type PendingItem =
  | { kind: "existing"; itemId: string; title: string }
  | { kind: "external"; result: ExternalSearchResultDto }
  | { kind: "manual"; request: CreateManualItemRequest; title: string };

type PersonalData = {
  collection?: AddToCollectionRequest;
  wishlist?: { interestLevel?: number; decisionNotes?: string | null };
  preorder?: CreatePreorderRequest;
  expansions?: {
    itemId?: string;
    title?: string;
    external?: { provider: ProviderCode; externalId: string };
    price?: number;
  }[];
  accessories?: PersonalData["expansions"];
};

type CompletedItem = {
  title: string;
  href: string;
  actionLabel: string;
};

export function ExternalImportPageClient({
  initialTarget = "collection",
  initialItemId,
}: ExternalImportPageClientProps) {
  const features = useProductFeatures();
  const command = usePendingCommand("item-action:pending", "/api/item-actions");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState(ANY_VALUE);
  const [provider, setProvider] = React.useState<"boardgamegeek" | "tesera">(
    "boardgamegeek",
  );
  const [target, setTarget] = React.useState<ManualQuickAction>(initialTarget);
  const [results, setResults] = React.useState<ExternalSearchResultDto[]>([]);
  const [itemTypes, setItemTypes] = React.useState<ItemTypeDto[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<PendingItem | null>(
    null,
  );
  const [completedItem, setCompletedItem] =
    React.useState<CompletedItem | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [externalWarnings, setExternalWarnings] = React.useState<string[]>([]);
  const [manualPreorderQuery, setManualPreorderQuery] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    listItemTypes()
      .then(setItemTypes)
      .catch(() => {
        setError("Не удалось загрузить типы игр для ручного добавления");
      });
  }, []);

  React.useEffect(() => {
    if (!initialItemId) return;
    let active = true;
    apiRequest<{ item: { id: string; title: string } }>(
      `/api/items/${encodeURIComponent(initialItemId)}`,
    )
      .then(({ item }) => {
        if (active)
          setSelectedItem({
            kind: "existing",
            itemId: item.id,
            title: item.title,
          });
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "Не удалось открыть игру",
          );
      });
    return () => {
      active = false;
    };
  }, [initialItemId]);

  async function confirmPending() {
    setSaving(true);
    setError(null);
    const pendingTarget = command.pending?.target as
      ManualQuickAction | undefined;
    try {
      const result = await command.run<{
        itemId: string;
        title: string;
        expansionPreorderIds?: string[];
        accessoryPreorderIds?: string[];
      }>();
      setCompletedItem(
        completionForTarget(
          pendingTarget ?? target,
          result.itemId,
          result.title,
          Boolean(
            result.expansionPreorderIds?.length ||
            result.accessoryPreorderIds?.length,
          ),
        ),
      );
      setSelectedItem(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить сохранение",
      );
    } finally {
      setSaving(false);
    }
  }

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
    setExternalWarnings([]);

    try {
      const response = await searchExternalItems({
        q: trimmedQuery,
        provider,
        type: type === ANY_VALUE ? undefined : type,
      });
      setResults(response.data);
      setSearched(true);
      setExternalWarnings(
        response.warnings?.map((warning) => warning.message) ?? [],
      );
    } catch (searchError) {
      setExternalWarnings([
        searchError instanceof Error
          ? searchError.message
          : "Не удалось выполнить внешний поиск",
      ]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function selectExternalItem(result: ExternalSearchResultDto) {
    setSelectedItem({ kind: "external", result });
    setError(null);
  }

  async function completeItem(data: PersonalData) {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);

    try {
      if (target === "collection" || target === "preorder") {
        const source =
          selectedItem.kind === "manual"
            ? { manual: selectedItem.request }
            : selectedItem.kind === "existing"
              ? { itemId: selectedItem.itemId }
              : {
                  itemId: (
                    await importExternalItem({
                      provider: selectedItem.result.provider,
                      externalId: selectedItem.result.externalId,
                      target: "reference_only",
                    })
                  ).item.id,
                };
        const result = await command.run<{
          itemId: string;
          title: string;
          expansionPreorderIds?: string[];
          accessoryPreorderIds?: string[];
        }>({
          ...source,
          target,
          ...data,
        });
        setCompletedItem(
          completionForTarget(
            target,
            result.itemId,
            result.title,
            Boolean(
              result.expansionPreorderIds?.length ||
              result.accessoryPreorderIds?.length,
            ),
          ),
        );
        setSelectedItem(null);
        return;
      }
      const details =
        selectedItem.kind === "external"
          ? await importExternalItem({
              provider: selectedItem.result.provider,
              externalId: selectedItem.result.externalId,
              target: "reference_only",
            })
          : selectedItem.kind === "manual"
            ? await createManualItem(selectedItem.request)
            : await apiRequest<{ item: { id: string; title: string } }>(
                `/api/items/${selectedItem.itemId}`,
              );
      const itemId = details.item.id;
      const title = details.item.title;

      if (target === "play") {
        await addItemToCollection(itemId, data.collection ?? {});
      } else if (target === "wishlist") {
        await addItemToWishlist(itemId);
        if (data.wishlist) {
          await updateItemUserData(itemId, data.wishlist);
        }
      }

      setCompletedItem(completionForTarget(target, itemId, title));
      setSelectedItem(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось завершить добавление",
      );
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setManualPreorderQuery(null);
    setQuery("");
    setType(ANY_VALUE);
    setProvider("boardgamegeek");
    setResults([]);
    setSearched(false);
    setError(null);
    setExternalWarnings([]);
    setSelectedItem(null);
    setCompletedItem(null);
  }

  if (command.pending && !saving)
    return (
      <main className="mx-auto grid max-w-3xl gap-4 p-6">
        <h1>
          {target === "preorder"
            ? "Подтвердить оформление предзаказа"
            : "Подтвердить сохранение"}
        </h1>
        <p>
          Результат предыдущего запроса ещё не подтверждён. Повтор безопасно
          завершит именно его, не создавая дубли.
        </p>
        {error ? <ErrorState description={error} /> : null}
        <Button onClick={() => void confirmPending()}>
          Повторить сохранение
        </Button>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">
          {target === "preorder" ? "Новый предзаказ" : "Добавить игру"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {target === "preorder"
            ? completedItem
              ? "Предзаказ сохранён. Его можно открыть в списке предзаказов."
              : selectedItem
                ? "Укажите магазин, стоимость и ожидаемый срок получения."
                : "Найдите игру по названию, чтобы оформить предзаказ."
            : "Выберите сохранённую игру, создайте новую вручную или воспользуйтесь внешним каталогом."}
        </p>
      </div>

      {target !== "preorder" ? (
        <WizardProgress
          step={
            completedItem ? 4 : selectedItem ? 3 : results.length > 0 ? 2 : 1
          }
        />
      ) : null}

      {error ? <ErrorState description={error} /> : null}

      {completedItem ? (
        <section className="grid justify-items-center gap-4 rounded-xl border bg-card p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <div>
            <h2 className="text-xl font-semibold">
              {target === "preorder" ? "Предзаказ оформлен" : "Готово"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {target === "preorder"
                ? `Предзаказ на «${completedItem.title}» сохранён.`
                : `«${completedItem.title}» сохранена.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={completedItem.href}>{completedItem.actionLabel}</Link>
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Добавить ещё
            </Button>
          </div>
        </section>
      ) : null}

      {!completedItem && target === "preorder" ? (
        <div hidden={Boolean(selectedItem)}>
          <PreorderGameSearch
            onSelectExisting={(item) => {
              setSelectedItem({
                kind: "existing",
                itemId: item.id,
                title: item.title,
              });
              setError(null);
            }}
            onSelectExternal={selectExternalItem}
            onManualQueryChange={setManualPreorderQuery}
          />
        </div>
      ) : null}

      {!selectedItem && !completedItem && target !== "preorder" ? (
        <LocalItemPicker
          onSelect={(item) => {
            setSelectedItem({
              kind: "existing",
              itemId: item.id,
              title: item.title,
            });
            setError(null);
          }}
        />
      ) : null}

      {!selectedItem && !completedItem && target !== "preorder" ? (
        <section className="grid gap-4 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              1. Найти в каталогах
            </h2>
            <p className="text-sm text-muted-foreground">
              Поиск выполняется по очереди: сначала BoardGameGeek, затем Tesera.
            </p>
            <div
              className="mt-3 flex gap-2"
              role="tablist"
              aria-label="Источник поиска"
            >
              <Button
                type="button"
                size="sm"
                variant={provider === "boardgamegeek" ? "default" : "outline"}
                onClick={() => setProvider("boardgamegeek")}
                role="tab"
                aria-selected={provider === "boardgamegeek"}
              >
                BoardGameGeek
              </Button>
              <Button
                type="button"
                size="sm"
                variant={provider === "tesera" ? "default" : "outline"}
                onClick={() => setProvider("tesera")}
                role="tab"
                aria-selected={provider === "tesera"}
              >
                Tesera
              </Button>
            </div>
          </div>

          <form
            onSubmit={searchItems}
            className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_13rem_auto]"
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
                onValueChange={(value) => setTarget(value as ManualQuickAction)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions
                    .filter(
                      (option) =>
                        features.mode === "full" ||
                        ["collection", "preorder"].includes(option.value),
                    )
                    .map((option) => (
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

          {externalWarnings.map((warning) => (
            <div
              key={warning}
              className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground"
            >
              {warning}
            </div>
          ))}
        </section>
      ) : null}

      {!selectedItem &&
      !completedItem &&
      target !== "preorder" &&
      searched &&
      !loading &&
      results.length === 0 &&
      !error ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="BoardGameGeek и Tesera не дали результатов. Попробуйте другой запрос или создайте карточку вручную ниже."
        />
      ) : null}

      {!selectedItem &&
      !completedItem &&
      target !== "preorder" &&
      results.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="search-results-title">
          <h2 id="search-results-title" className="text-base font-semibold">
            2. Выбрать найденную игру
          </h2>
          {results.map((result) => (
            <SearchResultRow
              key={`${result.provider}:${result.externalId}`}
              result={result}
              target={target}
              importing={false}
              onImport={() => selectExternalItem(result)}
            />
          ))}
        </section>
      ) : null}

      {!selectedItem &&
      !completedItem &&
      (target !== "preorder" || manualPreorderQuery !== null) ? (
        <section className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              {target === "preorder"
                ? "Добавление игры вручную"
                : "3. Ввести данные вручную"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {target === "preorder"
                ? "Игра не найдена. Введите её данные, затем заполните предзаказ."
                : "Можно создать игру сразу, без поиска и подключения внешних источников."}
            </p>
          </div>
          <ManualItemForm
            key={target === "preorder" ? manualPreorderQuery : "manual"}
            initialTitle={
              target === "preorder" ? (manualPreorderQuery ?? "") : ""
            }
            lockTarget={target === "preorder"}
            itemTypes={itemTypes}
            selectedType={type}
            target={target}
            onTargetChange={setTarget}
            onError={setError}
            onCreated={(request) => {
              setSelectedItem({
                kind: "manual",
                request,
                title: request.title,
              });
              setError(null);
            }}
          />
        </section>
      ) : null}

      {selectedItem && !completedItem ? (
        <PersonalDataStep
          key={`${selectedItem.kind}:${selectedItem.kind === "external" ? selectedItem.result.externalId : selectedItem.title}:${target}`}
          title={
            selectedItem.kind === "external"
              ? selectedItem.result.title
              : selectedItem.title
          }
          target={target}
          externalBase={
            selectedItem.kind === "external"
              ? {
                  provider: selectedItem.result.provider,
                  externalId: selectedItem.result.externalId,
                }
              : undefined
          }
          baseItemId={
            selectedItem.kind === "existing" ? selectedItem.itemId : undefined
          }
          saving={saving}
          onBack={() => setSelectedItem(null)}
          onSubmit={completeItem}
        />
      ) : null}
    </main>
  );
}

function WizardProgress({ step }: { step: number }) {
  const steps = ["Поиск", "Выбор", "Личные данные", "Готово"];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Шаги добавления игры">
      {steps.map((label, index) => {
        const number = index + 1;
        return (
          <li
            key={label}
            className={`rounded-lg border px-2 py-3 text-center text-xs sm:text-sm ${number === step ? "border-primary bg-primary/5 font-medium" : number < step ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            aria-current={number === step ? "step" : undefined}
          >
            {number}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function PersonalDataStep({
  title,
  baseItemId,
  externalBase,
  target,
  saving,
  onBack,
  onSubmit,
}: {
  title: string;
  baseItemId?: string;
  externalBase?: { provider: ProviderCode; externalId: string };
  target: ManualQuickAction;
  saving: boolean;
  onBack: () => void;
  onSubmit: (data: PersonalData) => Promise<void>;
}) {
  const [expansionItems, setExpansionItems] = React.useState<ExpansionDraft[]>(
    [],
  );
  const [location, setLocation] = React.useState("");
  const [personalRating, setPersonalRating] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [hasPurchase, setHasPurchase] = React.useState(false);
  const [purchaseShop, setPurchaseShop] = React.useState("");
  const [purchasePrice, setPurchasePrice] = React.useState("");
  const [purchaseCurrency, setPurchaseCurrency] = React.useState("RUB");
  const [purchaseDate, setPurchaseDate] = React.useState("");
  const [interestLevel, setInterestLevel] = React.useState("");
  const [decisionNotes, setDecisionNotes] = React.useState("");
  const [fullyPaid, setFullyPaid] = React.useState(false);
  const [orderUrl, setOrderUrl] = React.useState("");
  const [preorderShop, setPreorderShop] = React.useState("");
  const [deliveryMethod, setDeliveryMethod] =
    React.useState<PreorderDeliveryMethod>("unspecified");
  const [deliveryCost, setDeliveryCost] = React.useState("");
  const [pricingMode, setPricingMode] = React.useState<"lot" | "per_item">(
    "lot",
  );
  const [paymentType, setPaymentType] = React.useState<
    "one_time" | "installments"
  >("one_time");
  const [accessoryItems, setAccessoryItems] = React.useState<ExpansionDraft[]>(
    [],
  );
  const [preorderPrice, setPreorderPrice] = React.useState("");
  const [preorderCurrency, setPreorderCurrency] = React.useState("RUB");
  const [orderDate, setOrderDate] = React.useState("");
  const [precision, setPrecision] =
    React.useState<ExpectedDatePrecision>("unknown");
  const [expectedDay, setExpectedDay] = React.useState("");
  const [expectedMonth, setExpectedMonth] = React.useState("");
  const [expectedQuarter, setExpectedQuarter] = React.useState("1");
  const [expectedYear, setExpectedYear] = React.useState(
    String(new Date().getUTCFullYear()),
  );
  const [preorderStatus, setPreorderStatus] =
    React.useState<CreatePreorderRequest["status"]>("planned");
  const [preorderComment, setPreorderComment] = React.useState("");
  const collectionTarget = target === "collection" || target === "play";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (collectionTarget) {
      await onSubmit({
        collection: {
          location: nullableText(location),
          personalRating: personalRating ? Number(personalRating) : null,
          notes: nullableText(notes),
          purchase: hasPurchase
            ? {
                shop: purchaseShop.trim(),
                price: Number(purchasePrice),
                currency: purchaseCurrency.trim().toUpperCase(),
                purchaseDate: dateIso(purchaseDate),
                comment: null,
              }
            : undefined,
        },
      });
      return;
    }
    if (target === "wishlist") {
      await onSubmit({
        wishlist: {
          interestLevel: interestLevel ? Number(interestLevel) : undefined,
          decisionNotes: nullableText(decisionNotes),
        },
      });
      return;
    }
    if (target === "preorder") {
      await onSubmit({
        expansions: expansionPayload(
          expansionItems,
          pricingMode === "per_item",
        ),
        accessories: expansionPayload(
          accessoryItems,
          pricingMode === "per_item",
        ),
        preorder: {
          deliveryMethod,
          deliveryCost: deliveryCost.trim() ? Number(deliveryCost) : null,
          pricingMode,
          paymentType,
          fullyPaid: fullyPaid || preorderStatus === "paid",
          orderUrl: orderUrl.trim() || null,
          shop: preorderShop.trim(),
          price: Number(preorderPrice),
          currency: preorderCurrency.trim().toUpperCase(),
          orderDate: dateIso(orderDate),
          expectedDate: expectedDateForPrecision({
            precision,
            expectedDay,
            expectedMonth,
            expectedQuarter,
            expectedYear,
          }),
          expectedDatePrecision: precision,
          status: preorderStatus,
          comment: nullableText(preorderComment),
        },
      });
      return;
    }
    await onSubmit({});
  }

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {target === "preorder" ? "Данные предзаказа" : "3. Личные данные"}
          </h2>
          {target === "preorder" ? (
            <p className="mt-2 break-words text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {title}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {title} · {targetLabel(target)}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Назад к результатам
        </Button>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <fieldset disabled={saving} className="contents">
          {collectionTarget ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="personal-location">Место хранения</Label>
                  <Input
                    id="personal-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="mt-2"
                    placeholder="Стеллаж, полка"
                  />
                </div>
                <div>
                  <Label htmlFor="personal-rating">Личная оценка</Label>
                  <Input
                    id="personal-rating"
                    type="number"
                    min={1}
                    max={10}
                    value={personalRating}
                    onChange={(event) => setPersonalRating(event.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="personal-notes">Заметки</Label>
                <Textarea
                  id="personal-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasPurchase}
                  onChange={(event) => setHasPurchase(event.target.checked)}
                />{" "}
                Добавить покупку
              </label>
              {hasPurchase ? (
                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="purchase-shop">Магазин</Label>
                    <Input
                      id="purchase-shop"
                      value={purchaseShop}
                      onChange={(event) => setPurchaseShop(event.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase-price">Цена</Label>
                    <Input
                      id="purchase-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={purchasePrice}
                      onChange={(event) => setPurchasePrice(event.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase-currency">Валюта</Label>
                    <Input
                      id="purchase-currency"
                      value={purchaseCurrency}
                      onChange={(event) =>
                        setPurchaseCurrency(event.target.value.toUpperCase())
                      }
                      maxLength={3}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase-date">Дата покупки</Label>
                    <Input
                      id="purchase-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(event) => setPurchaseDate(event.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {target === "wishlist" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Уровень интереса</Label>
                <Select
                  value={interestLevel || "none"}
                  onValueChange={(value) =>
                    setInterestLevel(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не указан</SelectItem>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}/5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="decision-notes">Заметки к решению</Label>
                <Textarea
                  id="decision-notes"
                  value={decisionNotes}
                  onChange={(event) => setDecisionNotes(event.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          ) : null}

          {target === "preorder" ? (
            <div className="grid gap-6">
              <section
                className="grid gap-4 rounded-xl border bg-muted/10 p-4 sm:p-5"
                aria-labelledby="preorder-lot-heading"
              >
                <h3
                  id="preorder-lot-heading"
                  className="text-base font-semibold"
                >
                  Состав лота
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wizard-preorder-shop">Магазин</Label>
                    <PublisherPicker
                      id="wizard-preorder-shop"
                      value={preorderShop}
                      onChange={setPreorderShop}
                      multiple={false}
                      saveWith="preorder"
                      required
                    />
                  </div>
                  <PreorderDeliveryMethodField
                    id="wizard-delivery-method"
                    value={deliveryMethod}
                    onChange={setDeliveryMethod}
                  />

                  <div>
                    <PreorderUrlField value={orderUrl} onChange={setOrderUrl} />
                  </div>
                  <div>
                    <Label>Статус</Label>
                    <Select
                      value={preorderStatus}
                      onValueChange={(value) =>
                        setPreorderStatus(
                          value as CreatePreorderRequest["status"],
                        )
                      }
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Планируется</SelectItem>
                        <SelectItem value="ordered">Заказан</SelectItem>
                        <SelectItem value="paid">Оплачен</SelectItem>
                        <SelectItem value="shipped">Отправлен</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Основная игра:{" "}
                  <strong className="text-foreground">{title}</strong>.
                  Получение и отмена применяются ко всему лоту.
                </p>
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-semibold">
                    Добавить дополнения
                    {expansionItems.length > 0
                      ? ` (${expansionItems.length})`
                      : ""}
                  </summary>
                  <div className="mt-3">
                    <ExpansionSelection
                      value={expansionItems}
                      onChange={setExpansionItems}
                      currency={preorderCurrency}
                      baseItemId={baseItemId}
                      externalBase={externalBase}
                    />
                  </div>
                </details>
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-semibold">
                    Добавить аксессуары
                    {accessoryItems.length > 0
                      ? ` (${accessoryItems.length})`
                      : ""}
                  </summary>
                  <div className="mt-3">
                    <ExpansionSelection
                      kind="accessory"
                      value={accessoryItems}
                      onChange={setAccessoryItems}
                      currency={preorderCurrency}
                      baseItemId={baseItemId}
                      externalBase={externalBase}
                    />
                  </div>
                </details>

                <div className="grid gap-2">
                  <Label htmlFor="wizard-preorder-comment">Комментарий</Label>
                  <Textarea
                    id="wizard-preorder-comment"
                    value={preorderComment}
                    onChange={(event) => setPreorderComment(event.target.value)}
                    className="mt-2"
                  />
                </div>
              </section>
              <section
                className="grid gap-4 rounded-xl border bg-muted/10 p-4 sm:p-5"
                aria-labelledby="preorder-payment-heading"
              >
                <h3
                  id="preorder-payment-heading"
                  className="text-base font-semibold"
                >
                  Стоимость и оплата
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wizard-pricing-mode">
                      Стоимость предзаказа
                    </Label>
                    <Dropdown
                      id="wizard-pricing-mode"
                      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={pricingMode}
                      onValueChange={(selectedValue) =>
                        setPricingMode(selectedValue as "lot" | "per_item")
                      }
                    >
                      <option value="lot">Цена за весь лот</option>
                      <option value="per_item">Цены по позициям</option>
                    </Dropdown>
                  </div>

                  <div>
                    <Label htmlFor="wizard-preorder-price">
                      {pricingMode === "lot"
                        ? "Стоимость всего лота"
                        : "Стоимость основной игры"}
                    </Label>
                    <Input
                      id="wizard-preorder-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={preorderPrice}
                      onChange={(event) => setPreorderPrice(event.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="wizard-preorder-currency">Валюта</Label>
                    <Input
                      id="wizard-preorder-currency"
                      value={preorderCurrency}
                      onChange={(event) =>
                        setPreorderCurrency(event.target.value.toUpperCase())
                      }
                      maxLength={3}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="wizard-payment-type">Способ оплаты</Label>
                    <Dropdown
                      id="wizard-payment-type"
                      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={paymentType}
                      onValueChange={(selectedValue) =>
                        setPaymentType(
                          selectedValue as "one_time" | "installments",
                        )
                      }
                    >
                      <option value="one_time">Единоразовый платёж</option>
                      <option value="installments">Рассрочка</option>
                    </Dropdown>
                  </div>
                  <PreorderDeliveryCostField
                    id="wizard-delivery-cost"
                    value={deliveryCost}
                    currency={preorderCurrency}
                    onChange={setDeliveryCost}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fullyPaid || preorderStatus === "paid"}
                    onChange={(event) => setFullyPaid(event.target.checked)}
                  />
                  Полностью оплачен
                </label>
                <p className="text-sm text-muted-foreground">
                  {pricingMode === "lot"
                    ? "Укажите общую стоимость лота с учётом скидки. Цены отдельных позиций не обязательны."
                    : "Укажите цену основной игры и каждой выбранной позиции. Итоговая стоимость складывается автоматически."}
                </p>

                {pricingMode === "per_item" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        kind: "Дополнение",
                        items: expansionItems,
                        setItems: setExpansionItems,
                      },
                      {
                        kind: "Аксессуар",
                        items: accessoryItems,
                        setItems: setAccessoryItems,
                      },
                    ].flatMap(({ kind, items, setItems }) =>
                      items.map((item) => (
                        <div key={item.key}>
                          <Label htmlFor={"wizard-position-price-" + item.key}>
                            {kind}: {item.title} ({preorderCurrency})
                          </Label>
                          <Input
                            id={"wizard-position-price-" + item.key}
                            className="mt-2"
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={item.price}
                            onChange={(event) =>
                              setItems((previous) =>
                                previous.map((row) =>
                                  row.key === item.key
                                    ? { ...row, price: event.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        </div>
                      )),
                    )}
                  </div>
                ) : null}

                <div className="rounded-lg bg-primary/10 p-4">
                  <p className="font-medium">
                    Итого:{" "}
                    {new Intl.NumberFormat("ru-RU", {
                      maximumFractionDigits: 2,
                    }).format(
                      Number(preorderPrice || 0) +
                        Number(deliveryCost || 0) +
                        (pricingMode === "per_item"
                          ? [...expansionItems, ...accessoryItems].reduce(
                              (sum, item) => sum + Number(item.price || 0),
                              0,
                            )
                          : 0),
                    )}{" "}
                    {preorderCurrency}
                  </p>
                </div>
              </section>
              <section
                className="grid gap-4 rounded-xl border bg-muted/10 p-4 sm:p-5"
                aria-labelledby="preorder-dates-heading"
              >
                <h3
                  id="preorder-dates-heading"
                  className="text-base font-semibold"
                >
                  Даты и сроки
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wizard-order-date">Дата заказа</Label>
                    <Input
                      id="wizard-order-date"
                      type="date"
                      value={orderDate}
                      onChange={(event) => setOrderDate(event.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Точность срока</Label>
                    <Select
                      value={precision}
                      onValueChange={(value) =>
                        setPrecision(value as ExpectedDatePrecision)
                      }
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Точный день</SelectItem>
                        <SelectItem value="month">Месяц</SelectItem>
                        <SelectItem value="quarter">Квартал</SelectItem>
                        <SelectItem value="unknown">Неизвестно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {precision === "day" ? (
                    <div>
                      <Label htmlFor="wizard-expected-day">
                        Ожидаемая дата
                      </Label>
                      <Input
                        id="wizard-expected-day"
                        type="date"
                        value={expectedDay}
                        onChange={(event) => setExpectedDay(event.target.value)}
                        className="mt-2"
                        required
                      />
                    </div>
                  ) : null}
                  {precision === "month" ? (
                    <div>
                      <Label htmlFor="wizard-expected-month">
                        Ожидаемый месяц
                      </Label>
                      <Input
                        id="wizard-expected-month"
                        type="month"
                        value={expectedMonth}
                        onChange={(event) =>
                          setExpectedMonth(event.target.value)
                        }
                        className="mt-2"
                        required
                      />
                    </div>
                  ) : null}
                  {precision === "quarter" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="wizard-expected-year">Год</Label>
                        <Input
                          id="wizard-expected-year"
                          type="number"
                          min={1900}
                          max={2200}
                          value={expectedYear}
                          onChange={(event) =>
                            setExpectedYear(event.target.value)
                          }
                          className="mt-2"
                          required
                        />
                      </div>
                      <div>
                        <Label>Квартал</Label>
                        <Select
                          value={expectedQuarter}
                          onValueChange={setExpectedQuarter}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {target === "reference_only" ? (
            <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Будет сохранена только справочная карточка Item и внешний
              идентификатор.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving ? "Сохраняем" : "Завершить"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function SearchResultRow({
  result,
  target,
  importing,
  onImport,
}: {
  result: ExternalSearchResultDto;
  target: ManualQuickAction;
  importing: boolean;
  onImport: () => void;
}) {
  const TargetIcon =
    targetOptions.find((option) => option.value === target)?.icon ?? Download;

  return (
    <article className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[5rem_1fr_auto] sm:items-center">
      <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
        {result.imageUrl ? (
          <>
            {/* Provider-controlled preview URL; native image keeps the search adapter domain-agnostic. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.imageUrl}
              alt={`Обложка ${result.title}`}
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-normal">
            {result.title}
          </h2>
          {result.year ? (
            <Badge variant="secondary">{result.year}</Badge>
          ) : null}
          <Badge variant="outline">{providerLabel(result.provider)}</Badge>
          {result.itemTypeCode ? (
            <Badge variant="outline">
              {itemTypeLabel(result.itemTypeCode)}
            </Badge>
          ) : null}
        </div>

        {result.originalTitle && result.originalTitle !== result.title ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {result.originalTitle}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Игроки: {rangeLabel(result.minPlayers, result.maxPlayers)}
          </span>
          <span>
            Время: {rangeLabel(result.minPlayTime, result.maxPlayTime, " мин")}
          </span>
          <span>Рейтинг: {result.rating ? result.rating.toFixed(1) : "—"}</span>
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
        Выбрать
      </Button>
    </article>
  );
}

function ManualItemForm({
  itemTypes,
  selectedType,
  target,
  onTargetChange,
  onError,
  onCreated,
  initialTitle = "",
  lockTarget = false,
}: {
  itemTypes: ItemTypeDto[];
  selectedType: string;
  target: ManualQuickAction;
  onTargetChange: (target: ManualQuickAction) => void;
  onError: (message: string | null) => void;
  onCreated: (request: CreateManualItemRequest) => void;
  initialTitle?: string;
  lockTarget?: boolean;
}) {
  const features = useProductFeatures();
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
  const [designers, setDesigners] = React.useState("");
  const [artists, setArtists] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
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
      const body: CreateManualItemRequest = {
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
        designers: splitList(designers),
        artists: splitList(artists),
        imageUrl: optionalText(imageUrl),
        linkUrl: optionalText(linkUrl),
      };
      onCreated(body);
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
      {!lockTarget ? (
        <>
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              Быстрый ручной сценарий
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Выберите, что сделать после создания локальной карточки.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quickActionOptions
              .filter(
                (option) =>
                  features.mode === "full" ||
                  ["collection", "preorder"].includes(option.value),
              )
              .map((option) => {
                const Icon = option.icon;
                const selected = target === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTargetChange(option.value)}
                    className={[
                      "flex min-h-28 flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "bg-background hover:bg-secondary",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      ) : null}

      <div
        className={`grid gap-3 ${lockTarget ? "md:grid-cols-[minmax(0,1fr)_14rem_8rem]" : "md:grid-cols-[minmax(16rem,1fr)_14rem_8rem_13rem]"}`}
      >
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

        {!lockTarget ? (
          <div>
            <Label>Сценарий</Label>
            <Select
              value={target}
              onValueChange={(value) =>
                onTargetChange(value as ManualQuickAction)
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quickActionOptions
                  .filter(
                    (option) =>
                      features.mode === "full" ||
                      ["collection", "preorder"].includes(option.value),
                  )
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
          <PublisherPicker
            id="manual-publishers"
            value={publishers}
            onChange={setPublishers}
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

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="manual-designers">Авторы</Label>
          <Input
            id="manual-designers"
            value={designers}
            onChange={(event) => setDesigners(event.target.value)}
            className="mt-2"
            placeholder="Через запятую"
          />
        </div>
        <div>
          <Label htmlFor="manual-artists">Художники</Label>
          <Input
            id="manual-artists"
            value={artists}
            onChange={(event) => setArtists(event.target.value)}
            className="mt-2"
            placeholder="Через запятую"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="manual-image-url">Изображение по URL</Label>
          <div className="relative mt-2">
            <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="manual-image-url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="pl-9"
              placeholder="https://..."
              type="url"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="manual-link-url">Внешняя ссылка</Label>
          <div className="relative mt-2">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="manual-link-url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              className="pl-9"
              placeholder="https://..."
              type="url"
            />
          </div>
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
          {lockTarget
            ? "Продолжить"
            : (quickActionOptions.find((option) => option.value === target)
                ?.label ?? "Сохранить")}
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

function itemTypeLabel(
  itemTypeCode: NonNullable<ExternalSearchResultDto["itemTypeCode"]>,
) {
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

function completionForTarget(
  target: ManualQuickAction,
  itemId: string,
  title: string,
  hasExpansions = false,
): CompletedItem {
  if (target === "collection")
    return {
      title,
      href: `/items/${itemId}`,
      actionLabel: "Открыть коллекцию",
    };
  if (target === "play")
    return {
      title,
      href: `/plays?itemId=${encodeURIComponent(itemId)}`,
      actionLabel: "Добавить партию",
    };
  if (target === "wishlist")
    return {
      title,
      href: `/wishlist/${itemId}`,
      actionLabel: "Открыть wishlist",
    };
  if (target === "preorder")
    return {
      title,
      href: hasExpansions
        ? "/preorders"
        : `/preorders?itemId=${encodeURIComponent(itemId)}`,
      actionLabel: "Открыть предзаказы",
    };
  return {
    title,
    href: `/api/items/${encodeURIComponent(itemId)}`,
    actionLabel: "Открыть Item",
  };
}

function targetLabel(target: ManualQuickAction) {
  return (
    quickActionOptions.find((option) => option.value === target)?.label ??
    target
  );
}

function dateIso(value: string) {
  return value ? calendarToIso(value) : null;
}

function expectedDateForPrecision({
  precision,
  expectedDay,
  expectedMonth,
  expectedQuarter,
  expectedYear,
}: {
  precision: ExpectedDatePrecision;
  expectedDay: string;
  expectedMonth: string;
  expectedQuarter: string;
  expectedYear: string;
}) {
  if (precision === "unknown") return null;
  if (precision === "day") return dateIso(expectedDay);
  if (precision === "month") return dateIso(`${expectedMonth}-01`);
  const month = String((Number(expectedQuarter) - 1) * 3 + 1).padStart(2, "0");
  return dateIso(`${expectedYear}-${month}-01`);
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function rangeLabel(min?: number | null, max?: number | null, suffix = "") {
  if (min && max && min !== max) return `${min}–${max}${suffix}`;
  return min || max ? `${min ?? max}${suffix}` : "—";
}
