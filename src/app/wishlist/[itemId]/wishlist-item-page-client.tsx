"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Boxes, ExternalLink, Save, ShoppingBag, Star, Trash2 } from "lucide-react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { GameCover } from "@/components/game-cover";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/ui-state";
import {
  addWishlistItemToCollection,
  createWishlistPreorder,
  removeWishlistItem,
  updateWishlistUserData,
  wishlistDetailRestAdapter,
} from "@/features/wishlist/api";
import type { CreatePreorderRequest, ExpectedDatePrecision, PreorderStatus, WishlistItemDetailDto } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

type PreorderForm = {
  shop: string;
  price: string;
  currency: string;
  orderDate: string;
  precision: ExpectedDatePrecision;
  day: string;
  month: string;
  quarter: string;
  year: string;
  status: PreorderStatus;
  comment: string;
};

const emptyPreorder = (): PreorderForm => ({
  shop: "", price: "", currency: "RUB", orderDate: "", precision: "unknown",
  day: "", month: "", quarter: "1", year: String(new Date().getUTCFullYear()),
  status: "planned", comment: "",
});

export function WishlistItemPageClient({ itemId }: { itemId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const result = useAdapterQuery(wishlistDetailRestAdapter, { itemId });
  const [saving, setSaving] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [preorderOpen, setPreorderOpen] = React.useState(searchParams.get("action") === "preorder");
  const [preorder, setPreorder] = React.useState<PreorderForm>(emptyPreorder);

  async function addToCollection() {
    setSaving(true);
    try {
      await addWishlistItemToCollection(itemId);
      toast({ title: "Добавлено в коллекцию", description: "Использован существующий Item.", variant: "success" });
      router.push(`/collection/${itemId}`);
    } catch (error) {
      toast({ title: "Не удалось добавить в коллекцию", description: errorMessage(error), variant: "error" });
    } finally { setSaving(false); }
  }

  async function remove() {
    setSaving(true);
    try {
      await removeWishlistItem(itemId);
      toast({ title: "Удалено из wishlist", description: "Item и связанные данные сохранены.", variant: "success" });
      router.push("/wishlist");
    } catch (error) {
      toast({ title: "Не удалось удалить из wishlist", description: errorMessage(error), variant: "error" });
    } finally { setSaving(false); }
  }

  async function savePersonal(interestLevel: string, decisionNotes: string) {
    setSaving(true);
    try {
      await updateWishlistUserData(itemId, {
        interestLevel: interestLevel ? Number(interestLevel) : null,
        decisionNotes: nullableText(decisionNotes),
      });
      toast({ title: "Личные данные сохранены", variant: "success" });
      result.reload();
    } catch (error) {
      toast({ title: "Не удалось сохранить данные", description: errorMessage(error), variant: "error" });
    } finally { setSaving(false); }
  }

  async function savePreorder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createWishlistPreorder(itemId, preorderRequest(preorder));
      toast({ title: "Предзаказ создан", description: "Игра осталась в wishlist.", variant: "success" });
      setPreorderOpen(false);
      setPreorder(emptyPreorder());
      result.reload();
    } catch (error) {
      toast({ title: "Не удалось оформить предзаказ", description: errorMessage(error), variant: "error" });
    } finally { setSaving(false); }
  }

  if (result.isLoading) return <main className="w-full px-4 py-6 sm:px-6 lg:px-8"><LoadingState title="Загружаем wishlist" description="Получаем подробную справочную карточку." /></main>;
  if (result.error || !result.data) return <main className="w-full px-4 py-6 sm:px-6 lg:px-8"><ErrorState description={result.error ?? "Карточка wishlist не найдена"} onRetry={result.reload} /></main>;

  const details = result.data;
  const cover = details.item.cover?.url ?? details.item.cover?.path;
  const shopLinkIds = new Set(details.shopLinks.map((link) => link.id));
  const referenceLinks = [
    ...details.item.externalReferences.filter((entry) => entry.url).map((entry) => ({ id: entry.id, title: providerLabel(entry.provider), url: entry.url! })),
    ...details.item.links.filter((link) => !shopLinkIds.has(link.id)),
  ];

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" className="w-fit px-0"><Link href="/wishlist"><ArrowLeft className="h-4 w-4" />Назад к wishlist</Link></Button>

      <section className="grid gap-6 rounded-xl border bg-card p-4 lg:grid-cols-[16rem_1fr]">
        <GameCover src={cover} alt={details.item.cover?.alt ?? details.item.title} size="lg" className="h-auto min-h-80 w-full" />
        <div className="flex min-w-0 flex-col gap-5">
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{details.item.title}</h1><Badge variant="secondary">{details.item.type.name}</Badge>{details.userItem.states.includes("preordered") ? <Badge><ShoppingBag className="mr-1 h-3 w-3" />Предзаказ</Badge> : null}</div>{details.item.originalTitle && details.item.originalTitle !== details.item.title ? <p className="mt-2 text-muted-foreground">{details.item.originalTitle}</p> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Год" value={details.item.year ?? "—"} />
            <Metric label="Рейтинг" value={details.item.communityRating ? `${details.item.communityRating.toFixed(1)}/10` : "—"} />
            <Metric label="Игроки" value={range(details.item.minPlayers, details.item.maxPlayers)} />
            <Metric label="Время" value={range(details.item.minPlayTime, details.item.maxPlayTime, " мин")} />
            <Metric label="Возраст" value={details.item.minAge ? `${details.item.minAge}+` : "—"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addToCollection} disabled={saving}><Boxes className="h-4 w-4" />Добавить в коллекцию</Button>
            <Button type="button" variant="outline" onClick={() => setPreorderOpen(true)} disabled={saving}><ShoppingBag className="h-4 w-4" />Оформить предзаказ</Button>
            <Button type="button" variant="ghost" onClick={() => setRemoveOpen(true)} disabled={saving}><Trash2 className="h-4 w-4" />Удалить из wishlist</Button>
          </div>
        </div>
      </section>

      {details.item.images.length > 1 ? <Section title="Галерея"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{details.item.images.map((image) => <GameCover key={image.id} src={image.url ?? image.path} alt={image.caption ?? details.item.title} size="card" />)}</div></Section> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Section title="Описание"><p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{details.item.description || "Описание не импортировано."}</p></Section>
          <TaxonomySection title="Механики" values={details.item.mechanics} />
          <TaxonomySection title="Категории" values={details.item.categories} />
          <Section title="Авторы и издатели"><div className="grid gap-5 sm:grid-cols-3"><NameList label="Дизайнеры" values={details.item.designers} /><NameList label="Художники" values={details.item.artists} /><NameList label="Издатели" values={details.item.publishers} /></div></Section>
          {details.similarItems.length ? <Section title="Похожие игры"><div className="grid gap-3 sm:grid-cols-2">{details.similarItems.map((item) => <div key={item.id} className="flex gap-3 rounded-lg border p-3"><GameCover src={item.cover?.url ?? item.cover?.path} alt={item.title} size="sm" /><div><strong>{item.title}</strong><p className="text-sm text-muted-foreground">{item.year ?? "Год не указан"}</p></div></div>)}</div></Section> : null}
        </div>
        <aside className="grid h-fit gap-6">
          <LinksSection title="Ссылки" links={referenceLinks} />
          <LinksSection title="Магазины" links={details.shopLinks} />
          <LinksSection title="Видео" links={details.videos} />
          <Section title="Личные данные">
            <WishlistPersonalForm
              key={`${details.userItem.interestLevel ?? ""}:${details.userItem.decisionNotes ?? ""}`}
              initialInterestLevel={details.userItem.interestLevel}
              initialDecisionNotes={details.userItem.decisionNotes}
              saving={saving}
              onSave={savePersonal}
            />
          </Section>
        </aside>
      </div>

      <PreorderDialog open={preorderOpen} form={preorder} saving={saving} title={details.item.title} onOpenChange={setPreorderOpen} onChange={setPreorder} onSubmit={savePreorder} />
      <ConfirmationDialog open={removeOpen} onOpenChange={setRemoveOpen} title="Удалить из wishlist?" description="Item, ссылки, история, покупки и предзаказы сохранятся." confirmLabel="Удалить из wishlist" destructive onConfirm={remove} />
    </main>
  );
}

function PreorderDialog({ open, form, saving, title, onOpenChange, onChange, onSubmit }: { open: boolean; form: PreorderForm; saving: boolean; title: string; onOpenChange: (open: boolean) => void; onChange: React.Dispatch<React.SetStateAction<PreorderForm>>; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const update = <K extends keyof PreorderForm>(key: K, value: PreorderForm[K]) => onChange((current) => ({ ...current, [key]: value }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Оформить предзаказ</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
    <Field id="preorder-shop" label="Магазин"><Input id="preorder-shop" value={form.shop} onChange={(event) => update("shop", event.target.value)} required /></Field>
    <Field id="preorder-price" label="Стоимость"><Input id="preorder-price" type="number" min={0} step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} required /></Field>
    <Field id="preorder-currency" label="Валюта"><Input id="preorder-currency" value={form.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} maxLength={3} required /></Field>
    <Field id="preorder-status" label="Статус"><Select value={form.status} onValueChange={(value) => update("status", value as PreorderStatus)}><SelectTrigger id="preorder-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Планируется</SelectItem><SelectItem value="ordered">Заказан</SelectItem><SelectItem value="paid">Оплачен</SelectItem><SelectItem value="shipped">Отправлен</SelectItem></SelectContent></Select></Field>
    <Field id="preorder-order-date" label="Дата заказа"><Input id="preorder-order-date" type="date" value={form.orderDate} onChange={(event) => update("orderDate", event.target.value)} /></Field>
    <Field id="preorder-precision" label="Точность срока"><Select value={form.precision} onValueChange={(value) => update("precision", value as ExpectedDatePrecision)}><SelectTrigger id="preorder-precision"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Точный день</SelectItem><SelectItem value="month">Месяц</SelectItem><SelectItem value="quarter">Квартал</SelectItem><SelectItem value="unknown">Неизвестно</SelectItem></SelectContent></Select></Field>
    {form.precision === "day" ? <Field id="preorder-day" label="Ожидаемая дата"><Input id="preorder-day" type="date" value={form.day} onChange={(event) => update("day", event.target.value)} required /></Field> : null}
    {form.precision === "month" ? <Field id="preorder-month" label="Ожидаемый месяц"><Input id="preorder-month" type="month" value={form.month} onChange={(event) => update("month", event.target.value)} required /></Field> : null}
    {form.precision === "quarter" ? <div className="grid grid-cols-2 gap-3 sm:col-span-2"><Field id="preorder-year" label="Год"><Input id="preorder-year" type="number" min={1900} max={2200} value={form.year} onChange={(event) => update("year", event.target.value)} required /></Field><Field id="preorder-quarter" label="Квартал"><Select value={form.quarter} onValueChange={(value) => update("quarter", value)}><SelectTrigger id="preorder-quarter"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></Field></div> : null}
    <div className="sm:col-span-2"><Label htmlFor="preorder-comment">Комментарий</Label><Textarea id="preorder-comment" value={form.comment} onChange={(event) => update("comment", event.target.value)} className="mt-2" /></div>
    <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? "Сохраняем" : "Сохранить"}</Button></div>
  </form></DialogContent></Dialog>;
}

function WishlistPersonalForm({ initialInterestLevel, initialDecisionNotes, saving, onSave }: { initialInterestLevel?: number | null; initialDecisionNotes?: string | null; saving: boolean; onSave: (interestLevel: string, decisionNotes: string) => Promise<void> }) {
  const [interestLevel, setInterestLevel] = React.useState(initialInterestLevel?.toString() ?? "");
  const [decisionNotes, setDecisionNotes] = React.useState(initialDecisionNotes ?? "");
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(interestLevel, decisionNotes); }} className="grid gap-4">
    <div><Label>Интерес</Label><Select value={interestLevel || "none"} onValueChange={(value) => setInterestLevel(value === "none" ? "" : value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Не указан</SelectItem>{[1,2,3,4,5].map((value) => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}</SelectContent></Select></div>
    <div><Label htmlFor="wishlist-decision-notes">Заметки к решению</Label><Textarea id="wishlist-decision-notes" value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} className="mt-2" /></div>
    <Button type="submit" size="sm" disabled={saving}><Save className="h-4 w-4" />Сохранить</Button>
  </form>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border bg-card"><div className="border-b px-4 py-3"><h2 className="font-semibold">{title}</h2></div><div className="p-4">{children}</div></section>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block">{value}</strong></div>; }
function TaxonomySection({ title, values }: { title: string; values: { id: string; name: string }[] }) { return <Section title={title}>{values.length ? <div className="flex flex-wrap gap-2">{values.map((value) => <Badge key={value.id} variant="secondary">{value.name}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Не указаны.</p>}</Section>; }
function NameList({ label, values }: { label: string; values: { id: string; name: string }[] }) { return <div><strong className="text-sm">{label}</strong><p className="mt-2 text-sm leading-6 text-muted-foreground">{values.map((value) => value.name).join(", ") || "Не указаны."}</p></div>; }
function LinksSection({ title, links }: { title: string; links: { id: string; url: string; title?: string | null }[] }) { return <Section title={title}>{links.length ? <div className="grid gap-2">{links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><span className="truncate">{link.title || "Открыть"}</span><ExternalLink className="h-4 w-4 shrink-0" /></a>)}</div> : <p className="text-sm text-muted-foreground">Нет данных.</p>}</Section>; }
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div><Label htmlFor={id}>{label}</Label><div className="mt-2">{children}</div></div>; }
function range(min?: number | null, max?: number | null, suffix = "") { if (min && max && min !== max) return `${min}–${max}${suffix}`; return min || max ? `${min ?? max}${suffix}` : "—"; }
function nullableText(value: string) { const trimmed = value.trim(); return trimmed || null; }
function dateIso(value: string) { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null; }
function preorderRequest(form: PreorderForm): CreatePreorderRequest { const expectedDate = form.precision === "unknown" ? null : form.precision === "day" ? dateIso(form.day) : form.precision === "month" ? dateIso(`${form.month}-01`) : dateIso(`${form.year}-${String((Number(form.quarter) - 1) * 3 + 1).padStart(2, "0")}-01`); return { shop: form.shop.trim(), price: Number(form.price), currency: form.currency.trim().toUpperCase(), orderDate: dateIso(form.orderDate), expectedDate, expectedDatePrecision: form.precision, status: form.status, comment: nullableText(form.comment) }; }
function providerLabel(provider: string) { return provider === "boardgamegeek" ? "BoardGameGeek" : provider === "tesera" ? "Tesera" : provider; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : undefined; }
