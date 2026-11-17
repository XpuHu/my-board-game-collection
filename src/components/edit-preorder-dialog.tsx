"use client";
import { Dropdown } from "@/components/ui/dropdown";
import {
  PreorderDeliveryMethodField,
  PreorderDeliveryCostField,
} from "@/components/preorder-delivery-fields";
import { PreorderUrlField } from "@/components/preorder-url-field";
import { LotItemType } from "@/components/lot-item-type";
import { PublisherPicker } from "@/components/publisher-picker";
import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "./toast-provider";
import { usePendingCommand } from "@/shared/hooks/use-pending-command";
import {
  ExpansionSelection,
  expansionPayload,
  type ExpansionDraft,
} from "./expansion-selection";
import {
  preorderEditRequest,
  preorderEditValues,
  type PreorderEditValues,
} from "@/features/preorders/edit-form";
import type { PreorderListItemDto } from "@/shared/api";

export function EditPreorderDialog({
  preorder,
  onClose,
  onSaved,
}: {
  preorder: PreorderListItemDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState(() =>
    preorderEditValues(preorder),
  );
  const [additions, setAdditions] = React.useState<ExpansionDraft[]>([]);
  const [accessories, setAccessories] = React.useState<ExpansionDraft[]>([]);
  const command = usePendingCommand(
    `edit-preorder:${preorder.id}`,
    `/api/preorders/${encodeURIComponent(preorder.id)}`,
    "PATCH",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const busy = React.useRef(false);
  const formId = React.useId();
  const { toast } = useToast();
  const terminal =
    preorder.status === "received" || preorder.status === "cancelled";
  function set<K extends keyof PreorderEditValues>(
    key: K,
    value: PreorderEditValues[K],
  ) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError(null);
    try {
      if (
        !command.pending &&
        values.pricingMode === "per_item" &&
        [...additions, ...accessories].some((item) => !item.price.trim())
      )
        throw new Error("Укажите стоимость каждой добавляемой позиции");
      const patch = command.pending
        ? null
        : preorderEditRequest(
            preorder,
            values,
            expansionPayload(additions, values.pricingMode === "per_item"),
            expansionPayload(accessories, values.pricingMode === "per_item"),
          );
      if (patch && !Object.keys(patch).length) {
        onClose();
        return;
      }
      busy.current = true;
      setSaving(true);
      await command.run(patch ?? undefined);
      toast({ title: "Предзаказ обновлён", variant: "success" });
      onSaved();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить предзаказ",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const selectClass =
    "mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
    >
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Редактировать предзаказ</DialogTitle>
          <DialogDescription>
            {preorder.item.title}. Общие данные применяются ко всему лоту.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {command.pending && !saving ? (
            <p role="status" className="mb-3 text-sm">
              Есть неподтверждённое сохранение. Нажмите «Подтвердить
              сохранение», чтобы проверить результат без повторного добавления
              дополнений.
            </p>
          ) : null}
          <form id={formId} onSubmit={submit}>
            <fieldset
              disabled={saving || Boolean(command.pending)}
              className="grid gap-4"
            >
              <div>
                <Label htmlFor={`${formId}-shop`}>Магазин</Label>
                <PublisherPicker
                  id={`${formId}-shop`}
                  value={values.shop}
                  onChange={(value) => set("shop", value)}
                  multiple={false}
                  saveWith="preorder"
                  required
                />
              </div>
              <div>
                <Label htmlFor={`${formId}-pricing`}>
                  Стоимость предзаказа
                </Label>
                <Dropdown
                  id={`${formId}-pricing`}
                  className={selectClass}
                  value={values.pricingMode}
                  onValueChange={(selectedValue) =>
                    set(
                      "pricingMode",
                      selectedValue as PreorderEditValues["pricingMode"],
                    )
                  }
                >
                  <option value="lot">Цена за весь лот</option>
                  <option value="per_item">Цены по позициям</option>
                </Dropdown>
              </div>
              <div>
                <Label htmlFor={`${formId}-payment`}>Способ оплаты</Label>
                <Dropdown
                  id={`${formId}-payment`}
                  className={selectClass}
                  value={values.paymentType}
                  onValueChange={(selectedValue) =>
                    set(
                      "paymentType",
                      selectedValue as PreorderEditValues["paymentType"],
                    )
                  }
                >
                  <option value="unspecified">Не указан</option>
                  <option value="one_time">Единоразовый платёж</option>
                  <option value="installments">Рассрочка</option>
                </Dropdown>
              </div>
              <PreorderUrlField
                value={values.orderUrl}
                onChange={(value) => set("orderUrl", value)}
              />
              <PreorderDeliveryMethodField
                id={`${formId}-delivery-method`}
                value={values.deliveryMethod}
                onChange={(value) => set("deliveryMethod", value)}
              />
              <PreorderDeliveryCostField
                id={`${formId}-delivery-cost`}
                value={values.deliveryCost}
                currency={values.currency}
                onChange={(value) => set("deliveryCost", value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.fullyPaid}
                  onChange={(event) => set("fullyPaid", event.target.checked)}
                />
                Полностью оплачен — график платежей не нужен
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`${formId}-price`}>
                    {values.pricingMode === "lot"
                      ? "Стоимость всего лота"
                      : "Стоимость основной игры"}
                  </Label>
                  <Input
                    id={`${formId}-price`}
                    className="mt-2"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={values.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`${formId}-currency`}>Валюта</Label>
                  <Input
                    id={`${formId}-currency`}
                    className="mt-2"
                    required
                    minLength={3}
                    maxLength={3}
                    value={values.currency}
                    onChange={(e) =>
                      set("currency", e.target.value.toUpperCase())
                    }
                  />
                </div>
              </div>
              <section className="grid gap-3 rounded-lg border p-4">
                <h3 className="font-semibold">Состав лота</h3>
                {preorder.children?.length ? (
                  <ul className="divide-y">
                    {preorder.children.map((child) => (
                      <li
                        key={child.id}
                        className="grid gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <LotItemType code={child.item.type.code} />
                        <span className="text-sm font-medium">
                          {child.item.title}
                        </span>
                        {values.pricingMode === "per_item" ? (
                          <div>
                            <Label htmlFor={`${formId}-position-${child.id}`}>
                              Стоимость: {child.item.title}
                            </Label>
                            <Input
                              id={`${formId}-position-${child.id}`}
                              className="mt-2"
                              type="number"
                              min={0}
                              step="0.01"
                              required
                              value={values.positionPrices[child.id] ?? ""}
                              onChange={(e) =>
                                set("positionPrices", {
                                  ...values.positionPrices,
                                  [child.id]: e.target.value,
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Дополнения и аксессуары пока не добавлены.
                  </p>
                )}
              </section>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold">
                  Добавить дополнения
                  {additions.length > 0 ? ` (${additions.length})` : ""}
                </summary>
                <div className="mt-3 grid gap-3">
                  <ExpansionSelection
                    value={additions}
                    onChange={setAdditions}
                    baseItemId={preorder.item.id}
                    excludeIds={(preorder.children ?? []).map(
                      (child) => child.item.id,
                    )}
                    prices={values.pricingMode === "per_item"}
                    currency={values.currency}
                  />
                  <p className="text-xs text-muted-foreground">
                    {values.pricingMode === "lot"
                      ? "Дополнения войдут в общую стоимость. При необходимости измените цену всего лота."
                      : "Цена каждого нового дополнения прибавится к стоимости лота."}
                  </p>
                </div>
              </details>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold">
                  Добавить аксессуары
                  {accessories.length > 0 ? ` (${accessories.length})` : ""}
                </summary>
                <div className="mt-3 grid gap-3">
                  <ExpansionSelection
                    kind="accessory"
                    value={accessories}
                    onChange={setAccessories}
                    baseItemId={preorder.item.id}
                    excludeIds={(preorder.children ?? []).map(
                      (child) => child.item.id,
                    )}
                    prices={values.pricingMode === "per_item"}
                    currency={values.currency}
                  />
                  <p className="text-xs text-muted-foreground">
                    {values.pricingMode === "lot"
                      ? "Аксессуары войдут в общую стоимость. При необходимости измените цену всего лота."
                      : "Цена каждого нового аксессуара прибавится к стоимости лота."}
                  </p>
                </div>
              </details>
              <div>
                <Label htmlFor={`${formId}-status`}>Статус</Label>
                <Dropdown
                  id={`${formId}-status`}
                  className={selectClass}
                  disabled={terminal}
                  value={values.status}
                  onValueChange={(selectedValue) =>
                    set("status", selectedValue as PreorderEditValues["status"])
                  }
                >
                  <option value="planned">Планируется</option>
                  <option value="ordered">Заказан</option>
                  <option value="paid">Оплачен</option>
                  <option value="shipped">Отправлен</option>
                  {terminal ? (
                    <option value={preorder.status}>
                      {preorder.status === "received" ? "Получен" : "Отменён"}
                    </option>
                  ) : null}
                </Dropdown>
                <p className="mt-1 text-xs text-muted-foreground">
                  Получение, отмена и возврат в активные доступны через кнопки
                  предзаказа в списке.
                </p>
              </div>
              <div>
                <Label htmlFor={`${formId}-order-date`}>Дата заказа</Label>
                <Input
                  id={`${formId}-order-date`}
                  className="mt-2"
                  type="date"
                  value={values.orderDate}
                  onChange={(e) => set("orderDate", e.target.value)}
                />
              </div>
              {preorder.status === "received" ? (
                <div>
                  <Label htmlFor={`${formId}-received-date`}>
                    Дата получения
                  </Label>
                  <Input
                    id={`${formId}-received-date`}
                    className="mt-2"
                    type="date"
                    required
                    value={values.receivedDate}
                    onChange={(event) =>
                      set("receivedDate", event.target.value)
                    }
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor={`${formId}-precision`}>Ожидаемый срок</Label>
                <Dropdown
                  id={`${formId}-precision`}
                  className={selectClass}
                  value={values.precision}
                  onValueChange={(selectedValue) =>
                    set(
                      "precision",
                      selectedValue as PreorderEditValues["precision"],
                    )
                  }
                >
                  <option value="unknown">Дата неизвестна</option>
                  <option value="day">Точный день</option>
                  <option value="month">Месяц</option>
                  <option value="quarter">Квартал</option>
                </Dropdown>
              </div>
              {values.precision === "day" ? (
                <div>
                  <Label htmlFor={`${formId}-day`}>Ожидаемая дата</Label>
                  <Input
                    id={`${formId}-day`}
                    className="mt-2"
                    type="date"
                    required
                    value={values.day}
                    onChange={(e) => set("day", e.target.value)}
                  />
                </div>
              ) : null}
              {values.precision === "month" ? (
                <div>
                  <Label htmlFor={`${formId}-month`}>Ожидаемый месяц</Label>
                  <Input
                    id={`${formId}-month`}
                    className="mt-2"
                    type="month"
                    required
                    value={values.month}
                    onChange={(e) => set("month", e.target.value)}
                  />
                </div>
              ) : null}
              {values.precision === "quarter" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`${formId}-year`}>Год</Label>
                    <Input
                      id={`${formId}-year`}
                      className="mt-2"
                      type="number"
                      min={1900}
                      max={2200}
                      required
                      value={values.year}
                      onChange={(e) => set("year", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${formId}-quarter`}>Квартал</Label>
                    <Dropdown
                      id={`${formId}-quarter`}
                      className={selectClass}
                      value={values.quarter}
                      onValueChange={(selectedValue) =>
                        set("quarter", selectedValue)
                      }
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q} value={q}>
                          {q}-й квартал
                        </option>
                      ))}
                    </Dropdown>
                  </div>
                </div>
              ) : null}
              <div>
                <Label htmlFor={`${formId}-tracking`}>Трек-номер</Label>
                <Input
                  id={`${formId}-tracking`}
                  className="mt-2"
                  value={values.trackingNumber}
                  onChange={(e) => set("trackingNumber", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`${formId}-comment`}>Комментарий</Label>
                <Textarea
                  id={`${formId}-comment`}
                  className="mt-2"
                  value={values.comment}
                  onChange={(e) => set("comment", e.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </fieldset>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving
              ? "Сохраняем…"
              : command.pending
                ? "Подтвердить сохранение"
                : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
