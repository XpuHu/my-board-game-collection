"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Package, Plus, Trash2, XCircle } from "lucide-react";

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
  type PreordersListQuery,
  updatePreorderStatus,
} from "@/features/preorders/api";
import type { PreorderListItemDto, PreorderUiStatus } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const groups = [
  ["all", "Все"], ["active", "Активные"], ["received", "Полученные"], ["cancelled", "Отменённые"],
] as const;

export function PreordersPageClient({ initialItemId }: { initialItemId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const query = React.useMemo(() => preordersQueryFromUrl(searchParams, initialItemId), [searchParams, initialItemId]);
  const result = useAdapterQuery(preordersRestAdapter, query);
  const [datePreorder, setDatePreorder] = React.useState<PreorderListItemDto | null>(null);

  function setGroup(group: PreordersListQuery["group"]) {
    const next = new URLSearchParams(searchParams.toString());
    if (!group || group === "all") next.delete("group"); else next.set("group", group);
    next.delete("page");
    router.push(preordersHref(next));
  }

  async function changeStatus(preorder: PreorderListItemDto, status: "received" | "cancelled") {
    try {
      await updatePreorderStatus(preorder.id, status);
      toast({ title: status === "received" ? "Предзаказ получен" : "Предзаказ отменён", variant: "success" });
      result.reload();
    } catch (error) {
      toast({ title: "Не удалось обновить предзаказ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function remove(preorder: PreorderListItemDto) {
    if (!window.confirm(`Удалить предзаказ «${preorder.item.title}»?`)) return;
    try {
      await deletePreorder(preorder.id);
      toast({ title: "Предзаказ удалён", variant: "success" });
      result.reload();
    } catch (error) {
      toast({ title: "Не удалось удалить предзаказ", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Предзаказы</h1><p className="mt-1 text-sm text-muted-foreground">Активные ожидания, точные даты и история статусов.</p></div>
        <Button asChild><Link href={`/items/new?target=preorder${initialItemId ? `&itemId=${encodeURIComponent(initialItemId)}` : ""}`}><Plus className="h-4 w-4" /> Оформить предзаказ</Link></Button>
      </header>

      <nav className="flex gap-2 overflow-x-auto" aria-label="Статус предзаказов">
        {groups.map(([value, label]) => <Button key={value} type="button" size="sm" variant={(query.group ?? "all") === value ? "default" : "outline"} onClick={() => setGroup(value)}>{label}</Button>)}
      </nav>

      {result.isLoading ? <LoadingState title="Загружаем предзаказы" description="Получаем активные ожидания и историю переносов." /> : null}
      {result.error ? <ErrorState description={result.error} onRetry={result.reload} /> : null}
      {result.data && !result.data.data.length ? <EmptyState icon={Package} title="Предзаказов нет" description="Оформите предзаказ для игры из коллекции или wishlist." action={<Button asChild><Link href="/items/new?target=preorder"><Plus className="h-4 w-4" /> Оформить предзаказ</Link></Button>} /> : null}
      {result.data?.data.length ? <section className="rounded-xl border bg-card"><div className="border-b px-4 py-3 text-sm font-medium">{result.data.pagination.total} предзаказов</div><div className="divide-y">{result.data.data.map((preorder) => <PreorderRow key={preorder.id} preorder={preorder} onChangeDate={() => setDatePreorder(preorder)} onReceive={() => changeStatus(preorder, "received")} onCancel={() => changeStatus(preorder, "cancelled")} onDelete={() => remove(preorder)} />)}</div></section> : null}
      {result.data && result.data.pagination.totalPages > 1 ? <Pagination page={result.data.pagination.page} totalPages={result.data.pagination.totalPages} createHref={(page) => { const next = new URLSearchParams(searchParams.toString()); if (page <= 1) next.delete("page"); else next.set("page", String(page)); return preordersHref(next); }} /> : null}

      {datePreorder ? <ExpectedDateDialog preorder={datePreorder} open onOpenChange={(open) => { if (!open) setDatePreorder(null); }} onSaved={result.reload} /> : null}
    </main>
  );
}

function PreorderRow({ preorder, onChangeDate, onReceive, onCancel, onDelete }: { preorder: PreorderListItemDto; onChangeDate: () => void; onReceive: () => void; onCancel: () => void; onDelete: () => void }) {
  const active = preorder.uiStatus === "active" || preorder.uiStatus === "delayed";
  const relativeExpectedDate = formatRelativeExpectedDate(preorder);
  return <article className="grid gap-4 px-4 py-4 lg:grid-cols-[72px_minmax(0,1fr)_9rem_11rem_9rem_auto] lg:items-center"><GameCover src={preorder.item.cover?.url ?? preorder.item.cover?.path} alt={preorder.item.title} size="sm" /><div className="min-w-0"><Link href={`/collection/${preorder.item.id}`} className="font-medium hover:underline">{preorder.item.title}</Link><p className="mt-1 text-sm text-muted-foreground">{preorder.shop}{preorder.trackingNumber ? ` · ${preorder.trackingNumber}` : ""}</p></div><div><span className="block text-xs text-muted-foreground">Заказан</span><strong>{preorder.orderDate ? formatDate(preorder.orderDate) : "—"}</strong></div><div className="rounded-lg bg-primary/10 p-3"><span className="block text-xs text-muted-foreground">Ожидается</span><strong>{formatExpectedDate(preorder)}</strong>{relativeExpectedDate ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{relativeExpectedDate}</span> : null}</div><div><span className="block text-xs text-muted-foreground">Стоимость</span><strong>{formatMoney(preorder.price.amount, preorder.price.currency)}</strong></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><Badge variant={statusVariant(preorder.uiStatus)}>{statusLabel(preorder.uiStatus)}</Badge><Button type="button" variant="outline" size="icon" onClick={onChangeDate} aria-label="Изменить ожидаемую дату"><CalendarClock className="h-4 w-4" /></Button>{active ? <><Button type="button" variant="outline" size="icon" onClick={onReceive} aria-label="Отметить полученным"><CheckCircle2 className="h-4 w-4" /></Button><Button type="button" variant="outline" size="icon" onClick={onCancel} aria-label="Отменить предзаказ"><XCircle className="h-4 w-4" /></Button></> : null}<Button type="button" variant="outline" size="icon" onClick={onDelete} aria-label="Удалить предзаказ"><Trash2 className="h-4 w-4" /></Button></div></article>;
}

export function preordersQueryFromUrl(params: URLSearchParams, initialItemId?: string): PreordersListQuery { const page = Number(params.get("page") ?? 1); const group = params.get("group") as PreordersListQuery["group"] | null; return { group: group || "all", itemId: params.get("itemId") || initialItemId || undefined, page: Number.isInteger(page) && page > 0 ? page : 1, pageSize: 24 }; }
export function preordersHref(params: URLSearchParams) { const value = params.toString(); return value ? `/preorders?${value}` : "/preorders"; }
function statusLabel(status: PreorderUiStatus) { return ({ active: "Активный", delayed: "Задерживается", received: "Получен", cancelled: "Отменён" } satisfies Record<PreorderUiStatus, string>)[status]; }
function statusVariant(status: PreorderUiStatus): "default" | "secondary" | "outline" { if (status === "active" || status === "delayed") return "default"; if (status === "received") return "secondary"; return "outline"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function formatExpectedDate(preorder: PreorderListItemDto) { if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown") return "Дата неизвестна"; const date = new Date(preorder.expectedDate); if (preorder.expectedDatePrecision === "quarter") return `${Math.floor(date.getUTCMonth() / 3) + 1}-й квартал ${date.getUTCFullYear()}`; if (preorder.expectedDatePrecision === "month") return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(date); return formatDate(preorder.expectedDate); }
function formatRelativeExpectedDate(preorder: PreorderListItemDto) { if (!preorder.expectedDate || preorder.expectedDatePrecision !== "day") return null; const target = new Date(preorder.expectedDate); const today = new Date(); target.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0); const days = Math.round((target.getTime() - today.getTime()) / 86_400_000); return new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" }).format(days, "day"); }
function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
