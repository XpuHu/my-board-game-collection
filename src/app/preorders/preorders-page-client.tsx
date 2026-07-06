"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  Edit3,
  Package,
  Plus,
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
  type CreatePreorderRequest,
  type ItemListDto,
  type PreorderDto,
  type PreorderStatus,
} from "@/shared/api";

const activeStatuses: PreorderStatus[] = [
  "planned",
  "ordered",
  "paid",
  "shipped",
];

type PreorderFormState = {
  itemId: string;
  shop: string;
  price: string;
  currency: string;
  orderDate: string;
  expectedDate: string;
  receivedDate: string;
  trackingNumber: string;
  status: PreorderStatus;
  comment: string;
};

type ExpectedDateFormState = {
  expectedDate: string;
  reason: string;
  comment: string;
};

const emptyPreorderForm: PreorderFormState = {
  itemId: "",
  shop: "",
  price: "",
  currency: "RUB",
  orderDate: "",
  expectedDate: "",
  receivedDate: "",
  trackingNumber: "",
  status: "planned",
  comment: "",
};

const emptyExpectedDateForm: ExpectedDateFormState = {
  expectedDate: "",
  reason: "",
  comment: "",
};

export function PreordersPageClient() {
  const { toast } = useToast();
  const [preorders, setPreorders] = React.useState<PreorderDto[]>([]);
  const [items, setItems] = React.useState<ItemListDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadVersion, setLoadVersion] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preorderDialogOpen, setPreorderDialogOpen] = React.useState(false);
  const [dateDialogOpen, setDateDialogOpen] = React.useState(false);
  const [editingPreorder, setEditingPreorder] =
    React.useState<PreorderDto | null>(null);
  const [datePreorder, setDatePreorder] = React.useState<PreorderDto | null>(
    null,
  );
  const [preorderForm, setPreorderForm] =
    React.useState<PreorderFormState>(emptyPreorderForm);
  const [expectedDateForm, setExpectedDateForm] =
    React.useState<ExpectedDateFormState>(emptyExpectedDateForm);

  React.useEffect(() => {
    let isActive = true;

    Promise.all([
      apiClient.preorders.list(),
      apiClient.collection.list({ pageSize: 100 }),
      apiClient.wishlist.list({ pageSize: 100 }),
    ])
      .then(([preorderResponse, collectionResponse, wishlistResponse]) => {
        if (!isActive) {
          return;
        }

        setPreorders(preorderResponse);
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
            : "Не удалось загрузить предзаказы",
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

  function updatePreorderForm<K extends keyof PreorderFormState>(
    key: K,
    value: PreorderFormState[K],
  ) {
    setPreorderForm((current) => ({ ...current, [key]: value }));
  }

  function updateExpectedDateForm<K extends keyof ExpectedDateFormState>(
    key: K,
    value: ExpectedDateFormState[K],
  ) {
    setExpectedDateForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateDialog() {
    setEditingPreorder(null);
    setPreorderForm(emptyPreorderForm);
    setPreorderDialogOpen(true);
  }

  function openEditDialog(preorder: PreorderDto) {
    setEditingPreorder(preorder);
    setPreorderForm({
      itemId: preorder.itemId,
      shop: preorder.shop,
      price: String(preorder.price),
      currency: preorder.currency,
      orderDate: toDateInputValue(preorder.orderDate),
      expectedDate: toDateInputValue(preorder.expectedDate),
      receivedDate: toDateInputValue(preorder.receivedDate),
      trackingNumber: preorder.trackingNumber ?? "",
      status: preorder.status,
      comment: preorder.comment ?? "",
    });
    setPreorderDialogOpen(true);
  }

  function openDateDialog(preorder: PreorderDto) {
    setDatePreorder(preorder);
    setExpectedDateForm({
      expectedDate: toDateInputValue(preorder.expectedDate),
      reason: "",
      comment: "",
    });
    setDateDialogOpen(true);
  }

  async function savePreorder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!preorderForm.itemId) {
      toast({
        title: "Выберите игру",
        description: "Предзаказ должен быть связан с Item.",
        variant: "error",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = toPreorderRequest(preorderForm);

      if (editingPreorder) {
        await apiClient.preorders.update(editingPreorder.id, payload);
      } else {
        await apiClient.preorders.create(preorderForm.itemId, payload);
      }

      toast({
        title: editingPreorder ? "Предзаказ обновлен" : "Предзаказ создан",
        variant: "success",
      });
      setPreorderDialogOpen(false);
      reload();
    } catch (saveError) {
      toast({
        title: "Не удалось сохранить предзаказ",
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

  async function saveExpectedDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!datePreorder) {
      return;
    }

    setSaving(true);

    try {
      await apiClient.preorders.updateExpectedDate(datePreorder.id, {
        expectedDate: expectedDateForm.expectedDate
          ? new Date(expectedDateForm.expectedDate).toISOString()
          : null,
        reason: nullableText(expectedDateForm.reason),
        comment: nullableText(expectedDateForm.comment),
      });

      toast({
        title: "Дата обновлена",
        description: "В истории предзаказа создано событие переноса.",
        variant: "success",
      });
      setDateDialogOpen(false);
      reload();
    } catch (saveError) {
      toast({
        title: "Не удалось изменить дату",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Проверьте дату и попробуйте еще раз.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deletePreorderItem(preorder: PreorderDto) {
    if (!window.confirm(`Удалить предзаказ ${preorder.itemTitle}?`)) {
      return;
    }

    try {
      await apiClient.preorders.delete(preorder.id);
      toast({
        title: "Предзаказ удален",
        variant: "success",
      });
      reload();
    } catch (deleteError) {
      toast({
        title: "Не удалось удалить предзаказ",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Попробуйте еще раз.",
        variant: "error",
      });
    }
  }

  const activePreorders = preorders.filter((preorder) =>
    activeStatuses.includes(preorder.status),
  );
  const completedPreorders = preorders.filter(
    (preorder) => !activeStatuses.includes(preorder.status),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Предзаказы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Активные ожидания и быстрое изменение даты доставки.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Оформить предзаказ
        </Button>
      </div>

      {loading ? (
        <LoadingState
          title="Загружаем предзаказы"
          description="Получаем активные ожидания и историю переносов."
        />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : activePreorders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Активных предзаказов нет"
          description="Оформите предзаказ для игры из коллекции или wishlist, чтобы отслеживать ожидаемую дату доставки."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Оформить предзаказ
            </Button>
          }
        />
      ) : (
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="text-sm font-medium">
              Активные предзаказы: {activePreorders.length}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              <RotateCcw className="h-4 w-4" />
              Обновить
            </Button>
          </div>
          <div className="divide-y">
            {activePreorders.map((preorder) => (
              <PreorderRow
                key={preorder.id}
                preorder={preorder}
                onChangeDate={openDateDialog}
                onEdit={openEditDialog}
                onDelete={deletePreorderItem}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && completedPreorders.length > 0 ? (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 text-sm font-medium">
            Завершенные и отмененные
          </div>
          <div className="divide-y">
            {completedPreorders.map((preorder) => (
              <PreorderRow
                key={preorder.id}
                preorder={preorder}
                onChangeDate={openDateDialog}
                onEdit={openEditDialog}
                onDelete={deletePreorderItem}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить дату доставки</DialogTitle>
            <DialogDescription>
              {datePreorder?.itemTitle ?? "Предзаказ"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveExpectedDate} className="grid gap-4">
            <div>
              <Label htmlFor="expected-date">Ожидаемая дата</Label>
              <Input
                id="expected-date"
                type="date"
                value={expectedDateForm.expectedDate}
                onChange={(event) =>
                  updateExpectedDateForm("expectedDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="expected-date-reason">Причина</Label>
              <Input
                id="expected-date-reason"
                value={expectedDateForm.reason}
                onChange={(event) =>
                  updateExpectedDateForm("reason", event.target.value)
                }
                className="mt-2"
                placeholder="Перенос издателем, доставка, таможня"
              />
            </div>

            <div>
              <Label htmlFor="expected-date-comment">Комментарий</Label>
              <Textarea
                id="expected-date-comment"
                value={expectedDateForm.comment}
                onChange={(event) =>
                  updateExpectedDateForm("comment", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDateDialogOpen(false)}
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

      <Dialog open={preorderDialogOpen} onOpenChange={setPreorderDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPreorder
                ? "Редактировать предзаказ"
                : "Оформить предзаказ"}
            </DialogTitle>
            <DialogDescription>
              Предзаказ связан с Item и хранит текущий статус ожидания.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={savePreorder} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Игра</Label>
              <Select
                value={preorderForm.itemId || undefined}
                onValueChange={(value) => updatePreorderForm("itemId", value)}
                disabled={Boolean(editingPreorder)}
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
              <Label htmlFor="preorder-shop">Магазин</Label>
              <Input
                id="preorder-shop"
                value={preorderForm.shop}
                onChange={(event) =>
                  updatePreorderForm("shop", event.target.value)
                }
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label>Статус</Label>
              <Select
                value={preorderForm.status}
                onValueChange={(value) =>
                  updatePreorderForm("status", value as PreorderStatus)
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
                  <SelectItem value="received">Получен</SelectItem>
                  <SelectItem value="cancelled">Отменен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="preorder-price">Стоимость</Label>
              <Input
                id="preorder-price"
                type="number"
                min={0}
                step="0.01"
                value={preorderForm.price}
                onChange={(event) =>
                  updatePreorderForm("price", event.target.value)
                }
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="preorder-currency">Валюта</Label>
              <Input
                id="preorder-currency"
                value={preorderForm.currency}
                onChange={(event) =>
                  updatePreorderForm(
                    "currency",
                    event.target.value.toUpperCase(),
                  )
                }
                className="mt-2"
                maxLength={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="preorder-order-date">Дата заказа</Label>
              <Input
                id="preorder-order-date"
                type="date"
                value={preorderForm.orderDate}
                onChange={(event) =>
                  updatePreorderForm("orderDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="preorder-expected-date">Ожидаемая дата</Label>
              <Input
                id="preorder-expected-date"
                type="date"
                value={preorderForm.expectedDate}
                onChange={(event) =>
                  updatePreorderForm("expectedDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="preorder-received-date">Дата получения</Label>
              <Input
                id="preorder-received-date"
                type="date"
                value={preorderForm.receivedDate}
                onChange={(event) =>
                  updatePreorderForm("receivedDate", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="preorder-tracking">Трек-номер</Label>
              <Input
                id="preorder-tracking"
                value={preorderForm.trackingNumber}
                onChange={(event) =>
                  updatePreorderForm("trackingNumber", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="preorder-comment">Комментарий</Label>
              <Textarea
                id="preorder-comment"
                value={preorderForm.comment}
                onChange={(event) =>
                  updatePreorderForm("comment", event.target.value)
                }
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreorderDialogOpen(false)}
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

function PreorderRow({
  preorder,
  onChangeDate,
  onEdit,
  onDelete,
}: {
  preorder: PreorderDto;
  onChangeDate: (preorder: PreorderDto) => void;
  onEdit: (preorder: PreorderDto) => void;
  onDelete: (preorder: PreorderDto) => void;
}) {
  return (
    <article className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_10rem_10rem_auto] lg:items-center">
      <div className="min-w-0">
        <Link
          href={`/collection/${preorder.itemId}`}
          className="font-medium hover:underline"
        >
          {preorder.itemTitle}
        </Link>
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{preorder.shop}</span>
          {preorder.trackingNumber ? (
            <span>{preorder.trackingNumber}</span>
          ) : null}
          {preorder.events.length > 0 ? (
            <span>{preorder.events.length} изменений даты</span>
          ) : null}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground">Ожидается</div>
        <div className="font-medium">{formatDate(preorder.expectedDate)}</div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground">Стоимость</div>
        <div className="font-medium">
          {formatMoney(preorder.price, preorder.currency)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Badge variant={isActivePreorder(preorder) ? "default" : "secondary"}>
          {statusLabel(preorder.status)}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChangeDate(preorder)}
          title="Изменить дату доставки"
        >
          <CalendarClock className="h-4 w-4" />
          <span className="sr-only">Изменить дату доставки</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onEdit(preorder)}
          title="Редактировать предзаказ"
        >
          <Edit3 className="h-4 w-4" />
          <span className="sr-only">Редактировать предзаказ</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onDelete(preorder)}
          title="Удалить предзаказ"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Удалить предзаказ</span>
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

function toPreorderRequest(form: PreorderFormState): CreatePreorderRequest {
  return {
    shop: form.shop.trim(),
    price: Number(form.price),
    currency: form.currency.trim().toUpperCase(),
    orderDate: dateOrNull(form.orderDate),
    expectedDate: dateOrNull(form.expectedDate),
    receivedDate: dateOrNull(form.receivedDate),
    trackingNumber: nullableText(form.trackingNumber),
    status: form.status,
    comment: nullableText(form.comment),
  };
}

function dateOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isActivePreorder(preorder: PreorderDto) {
  return activeStatuses.includes(preorder.status);
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

function statusLabel(status: PreorderStatus) {
  const labels: Record<PreorderStatus, string> = {
    planned: "Планируется",
    ordered: "Заказан",
    paid: "Оплачен",
    shipped: "Отправлен",
    received: "Получен",
    cancelled: "Отменен",
  };

  return labels[status];
}
