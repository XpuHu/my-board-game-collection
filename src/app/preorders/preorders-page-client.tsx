"use client";
import { PaymentSchedule } from "@/components/payment-schedule";
import { ReceivePreorderDialog } from "@/components/receive-preorder-dialog";
import {
  PreorderActionButton,
  preorderActions,
  type PreorderAction,
} from "@/components/preorder-action-button";
import {
  preorderTotal,
  preorderDeliveryLabels,
} from "@/shared/lib/preorder-delivery";
import { PreorderPaymentStatus } from "@/components/preorder-payment-status";
import { LotItemType } from "@/components/lot-item-type";
import {
  formatExpectedDate,
  formatCalendarDate as formatDate,
  formatRelativeExpectedDate,
} from "@/shared/lib/calendar-date";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Package,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";

import { EditPreorderDialog } from "@/components/edit-preorder-dialog";
import { ExpectedDateDialog } from "@/components/expected-date-dialog";
import { GameCover } from "@/components/game-cover";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import {
  deletePreorder,
  preordersRestAdapter,
  reactivatePreorder,
  type PreordersListQuery,
  updatePreorderStatus,
} from "@/features/preorders/api";
import type { PreorderListItemDto, PreorderUiStatus } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const groups = [
  ["all", "Все"],
  ["active", "Активные"],
  ["received", "Полученные"],
  ["cancelled", "Отменённые"],
] as const;

export function PreordersPageClient({
  initialItemId,
}: {
  initialItemId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const query = React.useMemo(
    () => preordersQueryFromUrl(searchParams, initialItemId),
    [searchParams, initialItemId],
  );
  const result = useAdapterQuery(preordersRestAdapter, query);
  const [datePreorder, setDatePreorder] =
    React.useState<PreorderListItemDto | null>(null);

  const [editingPreorder, setEditingPreorder] =
    React.useState<PreorderListItemDto | null>(null);
  const [receivingPreorder, setReceivingPreorder] =
    React.useState<PreorderListItemDto | null>(null);
  const [pending, setPending] = React.useState<Map<string, PreorderAction>>(
    () => new Map(),
  );
  const pendingIds = React.useRef(new Map<string, PreorderAction>());
  async function mutate(
    id: string,
    kind: PreorderAction,
    action: () => Promise<void>,
  ) {
    if (pendingIds.current.has(id)) return;
    pendingIds.current.set(id, kind);
    setPending(new Map(pendingIds.current));
    try {
      await action();
    } finally {
      pendingIds.current.delete(id);
      setPending(new Map(pendingIds.current));
    }
  }
  React.useEffect(() => {
    const data = result.data;
    if (!data || result.isLoading || data.pagination.page !== query.page)
      return;
    const last = Math.max(1, data.pagination.totalPages);
    if ((query.page ?? 1) > last) {
      const next = new URLSearchParams(searchParams.toString());
      if (last === 1) next.delete("page");
      else next.set("page", String(last));
      router.replace(preordersHref(next));
    }
  }, [result.data, result.isLoading, query.page, searchParams, router]);

  function setGroup(group: PreordersListQuery["group"]) {
    const next = new URLSearchParams(searchParams.toString());
    if (!group || group === "all") next.delete("group");
    else next.set("group", group);
    next.delete("page");
    router.push(preordersHref(next));
  }

  async function changeStatus(
    preorder: PreorderListItemDto,
    status: "received" | "cancelled",
    receivedDate?: string,
  ) {
    try {
      await updatePreorderStatus(preorder.id, status, receivedDate);
      if (status === "received") setReceivingPreorder(null);
      toast({
        title:
          status === "received" ? "Предзаказ получен" : "Предзаказ отменён",
        variant: "success",
      });
      result.reload();
    } catch (error) {
      toast({
        title: "Не удалось обновить предзаказ",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  }

  async function reactivate(preorder: PreorderListItemDto) {
    try {
      await reactivatePreorder(preorder.id);
      toast({ title: "Предзаказ возвращён в активные", variant: "success" });
      result.reload();
    } catch (error) {
      toast({
        title: "Не удалось вернуть предзаказ в активные",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  }

  async function remove(preorder: PreorderListItemDto) {
    if (
      !window.confirm(
        preorder.children?.length
          ? `Удалить лот «${preorder.item.title}» вместе со всеми входящими позициями?`
          : `Удалить предзаказ «${preorder.item.title}»?`,
      )
    )
      return;
    try {
      await deletePreorder(preorder.id);
      toast({ title: "Предзаказ удалён", variant: "success" });
      result.reload();
    } catch (error) {
      toast({
        title: "Не удалось удалить предзаказ",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Предзаказы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Активные ожидания, точные даты и история статусов.
          </p>
        </div>
        <Button asChild>
          <Link
            href={`/items/new?target=preorder${query.itemId ? `&itemId=${encodeURIComponent(query.itemId)}` : ""}`}
          >
            <Plus className="h-4 w-4" /> Оформить предзаказ
          </Link>
        </Button>
      </header>

      <nav
        className="flex gap-2 overflow-x-auto"
        aria-label="Статус предзаказов"
      >
        {groups.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={(query.group ?? "all") === value ? "default" : "outline"}
            onClick={() => setGroup(value)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {result.isLoading ? (
        <LoadingState
          title="Загружаем предзаказы"
          description="Получаем активные ожидания и историю переносов."
        />
      ) : null}
      {result.error ? (
        <ErrorState description={result.error} onRetry={result.reload} />
      ) : null}
      {result.data && !result.data.data.length ? (
        <EmptyState
          icon={Package}
          title={
            query.group === "all" && !query.itemId
              ? "Предзаказов нет"
              : "В этой выборке предзаказов нет"
          }
          description="Оформите предзаказ или выберите другую группу."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/preorders">Все предзаказы</Link>
              </Button>
              <Button asChild>
                <Link
                  href={`/items/new?target=preorder${query.itemId ? `&itemId=${encodeURIComponent(query.itemId)}` : ""}`}
                >
                  <Plus className="h-4 w-4" /> Оформить предзаказ
                </Link>
              </Button>
            </div>
          }
        />
      ) : null}
      {result.data?.data.length ? (
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 text-sm font-medium">
            {result.data.pagination.total} предзаказов
          </div>
          <div className="divide-y">
            {result.data.data.map((preorder) => (
              <PreorderRow
                key={preorder.id}
                preorder={preorder}
                pendingAction={pending.get(preorder.id)}
                onPaymentsSaved={result.reload}
                onChangeDate={() => setDatePreorder(preorder)}
                onEdit={() => setEditingPreorder(preorder)}
                onReceive={() => setReceivingPreorder(preorder)}
                onCancel={() =>
                  void mutate(preorder.id, "cancel", () =>
                    changeStatus(preorder, "cancelled"),
                  )
                }
                onReactivate={() =>
                  void mutate(preorder.id, "reactivate", () =>
                    reactivate(preorder),
                  )
                }
                onDelete={() =>
                  void mutate(preorder.id, "delete", () => remove(preorder))
                }
              />
            ))}
          </div>
        </section>
      ) : null}
      {result.data && result.data.pagination.totalPages > 1 ? (
        <Pagination
          page={result.data.pagination.page}
          totalPages={result.data.pagination.totalPages}
          createHref={(page) => {
            const next = new URLSearchParams(searchParams.toString());
            if (page <= 1) next.delete("page");
            else next.set("page", String(page));
            return preordersHref(next);
          }}
        />
      ) : null}

      {receivingPreorder ? (
        <ReceivePreorderDialog
          title={receivingPreorder.item.title}
          saving={pending.get(receivingPreorder.id) === "receive"}
          onClose={() => setReceivingPreorder(null)}
          onSubmit={(date) =>
            mutate(receivingPreorder.id, "receive", () =>
              changeStatus(receivingPreorder, "received", date),
            )
          }
        />
      ) : null}
      {editingPreorder ? (
        <EditPreorderDialog
          key={editingPreorder.id}
          preorder={editingPreorder}
          onClose={() => setEditingPreorder(null)}
          onSaved={result.reload}
        />
      ) : null}
      {datePreorder ? (
        <ExpectedDateDialog
          preorder={datePreorder}
          open
          onOpenChange={(open) => {
            if (!open) setDatePreorder(null);
          }}
          onSaved={result.reload}
        />
      ) : null}
    </main>
  );
}

function PreorderRow({
  preorder,
  pendingAction,
  onChangeDate,
  onEdit,
  onReceive,
  onCancel,
  onReactivate,
  onDelete,
  onPaymentsSaved,
}: {
  preorder: PreorderListItemDto;
  pendingAction?: PreorderAction;
  onChangeDate: () => void;
  onEdit: () => void;
  onReceive: () => void;
  onCancel: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onPaymentsSaved: () => void;
}) {
  const active =
    preorder.uiStatus === "active" || preorder.uiStatus === "delayed";
  const received = preorder.uiStatus === "received";
  const pending = Boolean(pendingAction);
  const relativeExpectedDate = formatRelativeExpectedDate(preorder);
  const [paymentScheduleOpen, setPaymentScheduleOpen] = React.useState(false);
  const paymentPanelId = React.useId();
  const total = preorderTotal(preorder);
  return (
    <div>
      <article
        aria-busy={pending}
        className="grid gap-4 px-4 py-4 xl:grid-cols-[72px_minmax(0,1fr)_8rem_11rem_9rem_7rem_17.5rem] xl:items-center"
      >
        <GameCover
          src={preorder.item.cover?.url ?? preorder.item.cover?.path}
          alt={preorder.item.title}
          size="sm"
        />
        <div className="min-w-0">
          <Link
            href={`/items/${preorder.item.id}`}
            className="font-medium hover:underline"
          >
            {preorder.item.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {preorder.orderUrl ? (
              <a
                href={preorder.orderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {preorder.shop} · Открыть предзаказ
              </a>
            ) : (
              preorder.shop
            )}
            {preorder.trackingNumber ? ` · ${preorder.trackingNumber}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preorder.paymentType === "installments"
              ? "Рассрочка"
              : preorder.paymentType === "one_time"
                ? "Единоразовый платёж"
                : "Способ оплаты не указан"}{" "}
            ·{" "}
            {preorder.pricingMode === "lot"
              ? "Цена за весь лот"
              : "Цены по позициям"}
          </p>
          {preorder.deliveryMethod &&
          preorder.deliveryMethod !== "unspecified" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Доставка: {preorderDeliveryLabels[preorder.deliveryMethod]}
            </p>
          ) : null}
          {pendingAction ? (
            <p role="status" className="mt-2 text-sm font-medium text-primary">
              {preorderActions[pendingAction].pending}
            </p>
          ) : null}
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Заказан</span>
          <strong>
            {preorder.orderDate ? formatDate(preorder.orderDate) : "—"}
          </strong>
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <span className="block text-xs text-muted-foreground">
            {received ? "Получен" : "Ожидается"}
          </span>
          <strong>
            {received ? (
              preorder.receivedDate ? (
                <time dateTime={preorder.receivedDate}>
                  {formatDate(preorder.receivedDate)}
                </time>
              ) : (
                "Дата не указана"
              )
            ) : (
              formatExpectedDate(preorder)
            )}
          </strong>
          {received &&
          preorder.expectedDate &&
          preorder.expectedDatePrecision !== "unknown" ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Ожидался: {formatExpectedDate(preorder)}
            </span>
          ) : !received && relativeExpectedDate ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {relativeExpectedDate}
            </span>
          ) : null}
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Итого</span>
          <div className="flex items-center gap-2">
            <strong>{formatMoney(total, preorder.price.currency)}</strong>
            {!preorder.parentId ? (
              <PreorderPaymentStatus
                total={total}
                currency={preorder.price.currency}
                rows={preorder.paymentSchedule}
                fullyPaid={preorder.fullyPaid}
              />
            ) : null}
          </div>
          {preorder.deliveryCost != null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Доставка:{" "}
              {preorder.deliveryCost === 0
                ? "бесплатно"
                : formatMoney(preorder.deliveryCost, preorder.price.currency)}
            </p>
          ) : null}
        </div>
        <div>
          <Badge variant={statusVariant(preorder.uiStatus)}>
            {statusLabel(preorder.uiStatus)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {!preorder.parentId && !preorder.fullyPaid ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={pending}
              onClick={() => setPaymentScheduleOpen((open) => !open)}
              aria-label="График оплаты"
              title={
                paymentScheduleOpen ? "Свернуть график оплаты" : "График оплаты"
              }
              aria-expanded={paymentScheduleOpen}
              aria-controls={paymentPanelId}
            >
              <WalletCards className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pending}
            onClick={onEdit}
            aria-label="Редактировать предзаказ"
            title="Редактировать предзаказ"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            disabled={pending}
            type="button"
            variant="outline"
            size="icon"
            onClick={onChangeDate}
            aria-label="Изменить ожидаемую дату"
            title="Изменить ожидаемую дату"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
          {active ? (
            <>
              <PreorderActionButton
                action="receive"
                pendingAction={pendingAction}
                onClick={onReceive}
              />
              <PreorderActionButton
                action="cancel"
                pendingAction={pendingAction}
                onClick={onCancel}
              />
            </>
          ) : null}
          {received ? (
            <PreorderActionButton
              action="reactivate"
              pendingAction={pendingAction}
              onClick={onReactivate}
            />
          ) : null}
          <PreorderActionButton
            action="delete"
            pendingAction={pendingAction}
            onClick={onDelete}
          />
        </div>
      </article>
      {!preorder.parentId ? (
        <PaymentSchedule
          key={`${preorder.id}:${preorder.paymentVersion}:${total}:${preorder.fullyPaid}`}
          id={preorder.id}
          total={total}
          currency={preorder.price.currency}
          initialRows={preorder.paymentSchedule}
          initialVersion={preorder.paymentVersion}
          fullyPaid={preorder.fullyPaid}
          status={preorder.status}
          open={paymentScheduleOpen}
          panelId={paymentPanelId}
          onSaved={onPaymentsSaved}
        />
      ) : null}
      {preorder.children?.length ? (
        <details className="mx-4 mb-4 rounded-lg border bg-muted/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Состав лота: основная игра и ещё {preorder.children.length} поз.
          </summary>
          <ul className="divide-y border-t px-4">
            <li className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="inline-flex flex-wrap items-center gap-2">
                <LotItemType code={preorder.item.type.code} />
                {preorder.item.title}
              </span>
              <span>
                {preorder.pricingMode === "lot"
                  ? "Входит в стоимость лота"
                  : formatMoney(
                      preorder.basePrice ?? preorder.price.amount,
                      preorder.price.currency,
                    )}
              </span>
            </li>
            {preorder.children.map((child) => (
              <li
                key={child.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <LotItemType code={child.item.type.code} />
                  <Link
                    href={`/items/${child.item.id}`}
                    className="font-medium hover:underline"
                  >
                    {child.item.title}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(child.uiStatus)}>
                    {statusLabel(child.uiStatus)}
                  </Badge>
                  <span>
                    {child.priceKnown === false
                      ? "Входит в стоимость лота"
                      : formatMoney(child.price.amount, child.price.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function preordersQueryFromUrl(
  params: URLSearchParams,
  initialItemId?: string,
): PreordersListQuery {
  const page = Number(params.get("page") ?? 1);
  const group = params.get("group") as PreordersListQuery["group"] | null;
  return {
    group: group || "all",
    itemId: params.get("itemId") || initialItemId || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 24,
  };
}
export function preordersHref(params: URLSearchParams) {
  const value = params.toString();
  return value ? `/preorders?${value}` : "/preorders";
}
function statusLabel(status: PreorderUiStatus) {
  return (
    {
      active: "Активный",
      delayed: "Задерживается",
      received: "Получен",
      cancelled: "Отменён",
    } satisfies Record<PreorderUiStatus, string>
  )[status];
}
function statusVariant(
  status: PreorderUiStatus,
): "default" | "secondary" | "outline" {
  if (status === "active" || status === "delayed") return "default";
  if (status === "received") return "secondary";
  return "outline";
}
function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
  }).format(amount);
}
