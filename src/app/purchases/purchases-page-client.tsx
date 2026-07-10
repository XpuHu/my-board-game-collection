"use client";

import * as React from "react";
import Link from "next/link";
import {
  Edit3,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
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
  type CreatePurchaseRequest,
  type ItemListDto,
  type PurchaseDto,
} from "@/shared/api";

type PurchaseFormState = {
  itemId: string;
  shop: string;
  price: string;
  currency: string;
  deliveryCost: string;
  discount: string;
  totalPrice: string;
  purchaseDate: string;
  comment: string;
};

const emptyPurchaseForm: PurchaseFormState = {
  itemId: "",
  shop: "",
  price: "",
  currency: "RUB",
  deliveryCost: "",
  discount: "",
  totalPrice: "",
  purchaseDate: "",
  comment: "",
};

export function PurchasesPageClient() {
  const { toast } = useToast();
  const [purchases, setPurchases] = React.useState<PurchaseDto[]>([]);
  const [items, setItems] = React.useState<ItemListDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadVersion, setLoadVersion] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPurchase, setEditingPurchase] =
    React.useState<PurchaseDto | null>(null);
  const [form, setForm] =
    React.useState<PurchaseFormState>(emptyPurchaseForm);

  React.useEffect(() => {
    let isActive = true;

    Promise.all([
      apiClient.purchases.list(),
      apiClient.collection.list({ pageSize: 100 }),
      apiClient.wishlist.list({ pageSize: 100 }),
    ])
      .then(([purchaseResponse, collectionResponse, wishlistResponse]) => {
        if (!isActive) {
          return;
        }

        setPurchases(purchaseResponse);
        setItems(mergeItems(collectionResponse.data, wishlistResponse.data));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить покупки",
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
  }, [loadVersion]);

  function reload() {
    setLoading(true);
    setLoadVersion((current) => current + 1);
  }

  function updateForm<K extends keyof PurchaseFormState>(
    key: K,
    value: PurchaseFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateDialog() {
    setEditingPurchase(null);
    setForm(emptyPurchaseForm);
    setDialogOpen(true);
  }

  function openEditDialog(purchase: PurchaseDto) {
    setEditingPurchase(purchase);
    setForm({
      itemId: purchase.itemId,
      shop: purchase.shop,
      price: String(purchase.price),
      currency: purchase.currency,
      deliveryCost: optionalMoneyValue(purchase.deliveryCost),
      discount: optionalMoneyValue(purchase.discount),
      totalPrice: String(purchase.totalPrice),
      purchaseDate: toDateInputValue(purchase.purchaseDate),
      comment: purchase.comment ?? "",
    });
    setDialogOpen(true);
  }

  async function savePurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.itemId) {
      toast({
        title: "Выберите игру",
        description: "Покупка должна быть связана с локальным Item.",
        variant: "error",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = toPurchaseRequest(form);

      if (editingPurchase) {
        await apiClient.purchases.update(editingPurchase.id, payload);
      } else {
        await apiClient.purchases.create(form.itemId, payload);
      }

      toast({
        title: editingPurchase ? "Покупка обновлена" : "Покупка добавлена",
        description: "Стоимость будет учтена в статистике коллекции.",
        variant: "success",
      });
      setDialogOpen(false);
      reload();
    } catch (saveError) {
      toast({
        title: "Не удалось сохранить покупку",
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

  async function deletePurchaseItem(purchase: PurchaseDto) {
    if (!window.confirm(`Удалить покупку ${purchase.shop}?`)) {
      return;
    }

    try {
      await apiClient.purchases.delete(purchase.id);
      toast({
        title: "Покупка удалена",
        variant: "success",
      });
      reload();
    } catch (deleteError) {
      toast({
        title: "Не удалось удалить покупку",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Попробуйте еще раз.",
        variant: "error",
      });
    }
  }

  const itemTitles = new Map(items.map((entry) => [entry.item.id, entry.item.title]));
  const totals = formatTotals(purchases);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Покупки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ручная история стоимости коллекции без внешних магазинов.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Добавить покупку
        </Button>
      </div>

      {loading ? (
        <LoadingState
          title="Загружаем покупки"
          description="Получаем локальные записи Purchase."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Покупок пока нет"
          description="Добавьте покупку к локальной игре, чтобы стоимость появилась в статистике коллекции."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Добавить покупку
            </Button>
          }
        />
      ) : (
        <section className="rounded-lg border bg-card">
          <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">
              {purchases.length} покупок
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-muted-foreground">
                Итого: {totals}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={reload}>
                <RotateCcw className="h-4 w-4" />
                Обновить
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                itemTitle={itemTitles.get(purchase.itemId) ?? "Item"}
                onEdit={openEditDialog}
                onDelete={deletePurchaseItem}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? "Редактировать покупку" : "Добавить покупку"}
            </DialogTitle>
            <DialogDescription>
              Покупка хранится локально и учитывается в стоимости коллекции.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={savePurchase} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Игра</Label>
              <Select
                value={form.itemId || undefined}
                onValueChange={(value) => updateForm("itemId", value)}
                disabled={Boolean(editingPurchase)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Выберите игру" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((entry) => (
                    <SelectItem key={entry.item.id} value={entry.item.id}>
                      {entry.item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="purchase-shop">Магазин</Label>
              <Input
                id="purchase-shop"
                value={form.shop}
                onChange={(event) => updateForm("shop", event.target.value)}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="purchase-date">Дата покупки</Label>
              <Input
                id="purchase-date"
                type="date"
                value={form.purchaseDate}
                onChange={(event) =>
                  updateForm("purchaseDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="purchase-price">Цена</Label>
              <Input
                id="purchase-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(event) => updateForm("price", event.target.value)}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="purchase-currency">Валюта</Label>
              <Input
                id="purchase-currency"
                value={form.currency}
                onChange={(event) =>
                  updateForm("currency", event.target.value.toUpperCase())
                }
                className="mt-2"
                maxLength={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="purchase-delivery">Доставка</Label>
              <Input
                id="purchase-delivery"
                type="number"
                min={0}
                step="0.01"
                value={form.deliveryCost}
                onChange={(event) =>
                  updateForm("deliveryCost", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="purchase-discount">Скидка</Label>
              <Input
                id="purchase-discount"
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(event) => updateForm("discount", event.target.value)}
                className="mt-2"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="purchase-total">Итоговая стоимость</Label>
              <Input
                id="purchase-total"
                type="number"
                min={0}
                step="0.01"
                value={form.totalPrice}
                onChange={(event) =>
                  updateForm("totalPrice", event.target.value)
                }
                className="mt-2"
                placeholder="Если пусто, будет рассчитана автоматически"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="purchase-comment">Комментарий</Label>
              <Textarea
                id="purchase-comment"
                value={form.comment}
                onChange={(event) => updateForm("comment", event.target.value)}
                className="mt-2"
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

function PurchaseRow({
  purchase,
  itemTitle,
  onEdit,
  onDelete,
}: {
  purchase: PurchaseDto;
  itemTitle: string;
  onEdit: (purchase: PurchaseDto) => void;
  onDelete: (purchase: PurchaseDto) => void;
}) {
  return (
    <article className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_10rem_10rem_auto] lg:items-center">
      <div className="min-w-0">
        <Link
          href={`/collection/${purchase.itemId}`}
          className="font-medium hover:underline"
        >
          {itemTitle}
        </Link>
        <div className="mt-1 text-sm text-muted-foreground">
          {purchase.shop}
          {purchase.comment ? ` · ${purchase.comment}` : ""}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground">Дата</div>
        <div className="font-medium">{formatDate(purchase.purchaseDate)}</div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground">Итого</div>
        <div className="font-medium">
          {formatMoney(purchase.totalPrice, purchase.currency)}
        </div>
      </div>

      <div className="flex gap-2 lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onEdit(purchase)}
          title="Редактировать покупку"
        >
          <Edit3 className="h-4 w-4" />
          <span className="sr-only">Редактировать покупку</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onDelete(purchase)}
          title="Удалить покупку"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Удалить покупку</span>
        </Button>
      </div>
    </article>
  );
}

function mergeItems(
  collectionItems: ItemListDto[],
  wishlistItems: ItemListDto[],
) {
  const byId = new Map<string, ItemListDto>();

  [...collectionItems, ...wishlistItems].forEach((entry) => {
    byId.set(entry.item.id, entry);
  });

  return Array.from(byId.values()).sort((left, right) =>
    left.item.title.localeCompare(right.item.title, "ru"),
  );
}

function toPurchaseRequest(form: PurchaseFormState): CreatePurchaseRequest {
  return {
    shop: form.shop.trim(),
    price: Number(form.price),
    currency: form.currency.trim().toUpperCase(),
    deliveryCost: nullableNumber(form.deliveryCost),
    discount: nullableNumber(form.discount),
    totalPrice: nullableNumber(form.totalPrice),
    purchaseDate: dateOrNull(form.purchaseDate),
    comment: nullableText(form.comment),
  };
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dateOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function optionalMoneyValue(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Не указана";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ru", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTotals(purchases: PurchaseDto[]) {
  if (purchases.length === 0) {
    return "0";
  }

  const totals = purchases.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.currency] =
      (accumulator[item.currency] ?? 0) + item.totalPrice;
    return accumulator;
  }, {});

  return Object.entries(totals)
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(", ");
}
