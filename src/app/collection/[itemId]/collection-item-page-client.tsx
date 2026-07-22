"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Clock3, ExternalLink, Gamepad2, Images, Star, Users } from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { CollectionEditPanels } from "@/components/collection-edit-panels";
import { GameCover } from "@/components/game-cover";
import { Panel } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { collectionDetailRestAdapter } from "@/features/collection/api";
import type { CollectionItemDetailDto } from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";

const tabs = ["overview", "expansions", "plays", "photos", "purchases", "notes", "relations"] as const;
type DetailTab = (typeof tabs)[number];
const tabLabels: Record<DetailTab, string> = {
  overview: "Обзор", expansions: "Дополнения", plays: "Партии", photos: "Фото",
  purchases: "Покупки", notes: "Заметки", relations: "Связи",
};

export function CollectionItemPageClient({ itemId }: { itemId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as DetailTab | null;
  const activeTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : "overview";
  const query = useAdapterQuery(collectionDetailRestAdapter, { itemId }, { key: itemId });
  const [playOpen, setPlayOpen] = React.useState(false);

  function setTab(tab: DetailTab) {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") next.delete("tab"); else next.set("tab", tab);
    const suffix = next.toString();
    router.push(`/collection/${itemId}${suffix ? `?${suffix}` : ""}`);
  }

  if (query.isLoading) return <main className="w-full px-4 py-6 sm:px-6 lg:px-8"><LoadingState title="Загружаем карточку" description="Получаем компактные данные владельца." /></main>;
  if (query.error || !query.data) return <main className="w-full px-4 py-6 sm:px-6 lg:px-8"><ErrorState description={query.error ?? "Карточка коллекции не найдена"} onRetry={query.reload} /></main>;

  const details = query.data;
  const referenceUrl = details.item.externalReferences.find(({ url }) => url)?.url ?? details.item.links.find(({ type }) => type === "official")?.url;

  return (
    <main className="grid w-full gap-5 px-4 pb-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Хлебные крошки">
        <Link href="/collection" className="hover:text-foreground">Моя коллекция</Link><span>/</span><span className="truncate text-foreground">{details.item.title}</span>
      </nav>

      <section className="grid gap-5 rounded-xl border bg-card p-5 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
        <GameCover src={details.item.cover?.url ?? details.item.cover?.path} alt={details.item.cover?.alt ?? details.item.title} size="lg" className="mx-auto lg:mx-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{details.item.title}</h1><Badge variant="secondary">{details.item.type.name}</Badge></div>
          {details.item.originalTitle ? <p className="mt-1 text-sm text-muted-foreground">{details.item.originalTitle}</p> : null}
          <div className="mt-5 flex flex-wrap gap-6">
            <Fact icon={<Users />} label="Игроки" value={range(details.item.minPlayers, details.item.maxPlayers)} />
            <Fact icon={<Clock3 />} label="Минут" value={range(details.item.minPlayTime, details.item.maxPlayTime)} />
            <Fact icon={<Star />} label="Рейтинг" value={details.item.communityRating?.toFixed(1) ?? "—"} />
            <Fact icon={<Gamepad2 />} label="Сложность" value={details.item.complexity?.toFixed(1) ?? "—"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">{details.item.mechanics.slice(0, 5).map(({ id, name }) => <Badge key={id} variant="outline">{name}</Badge>)}</div>
        </div>
        <aside className="grid content-start gap-3 rounded-lg border bg-background/30 p-4 text-sm">
          <Summary label="Добавлено">{formatDate(details.userItem.ownedAt)}</Summary>
          <Summary label="Место">{details.userItem.location ?? "Не указано"}</Summary>
          <Summary label="Личная оценка">{details.userItem.personalRating ? `${details.userItem.personalRating}/10` : "Без оценки"}</Summary>
          <Summary label="Партий">{details.playSummary.count}</Summary>
          <Button type="button" className="mt-2" onClick={() => setPlayOpen(true)}><CalendarPlus className="h-4 w-4" /> Добавить партию</Button>
          {referenceUrl ? <Button asChild variant="outline"><a href={referenceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Информация об игре</a></Button> : null}
        </aside>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Разделы карточки">
        {tabs.map((tab) => <Button key={tab} type="button" size="sm" variant={activeTab === tab ? "default" : "outline"} onClick={() => setTab(tab)}>{tabLabels[tab]}{tabCount(tab, details) ? ` (${tabCount(tab, details)})` : ""}</Button>)}
      </div>

      <DetailContent tab={activeTab} details={details} onAddPlay={() => setPlayOpen(true)} />
      {activeTab === "overview" ? <CollectionEditPanels details={details} onSaved={query.reload} /> : null}

      {playOpen ? <AddPlayDialog open={playOpen} onOpenChange={setPlayOpen} initialItemId={details.item.id} initialItemTitle={details.item.title} onSaved={query.reload} /> : null}
    </main>
  );
}

function DetailContent({ tab, details, onAddPlay }: { tab: DetailTab; details: CollectionItemDetailDto; onAddPlay: () => void }) {
  if (tab === "overview") return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]"><Panel title="Об игре"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{details.item.description ?? "Описание пока не добавлено."}</p><Taxonomy title="Категории" values={details.item.categories} /><Taxonomy title="Авторы" values={details.item.designers} /></Panel><div className="grid gap-5"><Panel title="Данные владельца"><dl className="grid gap-3 text-sm"><Summary label="Статус">В коллекции</Summary><Summary label="Место хранения">{details.userItem.location ?? "—"}</Summary><Summary label="Заметка">{details.userItem.notes ?? "—"}</Summary></dl></Panel><Panel title="Сводка партий"><p className="text-3xl font-semibold">{details.playSummary.count}</p><p className="mt-2 text-sm text-muted-foreground">Всего {Math.round(details.playSummary.totalDurationMinutes / 60)} ч · последняя {formatDate(details.playSummary.lastPlayedAt)}</p></Panel></div></div>;
  if (tab === "plays") return <Panel title="История партий" action={<Button type="button" size="sm" onClick={onAddPlay}><CalendarPlus className="h-4 w-4" /> Добавить</Button>}>{details.recentPlays.length ? <div className="divide-y">{details.recentPlays.map((play) => <div key={play.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]"><span className="font-medium">{formatDate(play.playedAt)}</span><span className="text-muted-foreground">{play.playersCount ? `${play.playersCount} игроков` : "—"}</span><span className="text-muted-foreground">{play.durationMinutes ? `${play.durationMinutes} мин` : "—"}</span><Badge variant="secondary">{play.result ?? "Без результата"}</Badge></div>)}</div> : <EmptyState icon={CalendarPlus} title="Партий пока нет" description="Добавьте первую партию для этой игры." />}</Panel>;
  if (tab === "photos") return <Panel title="Фотографии">{details.item.images.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{details.item.images.map((image) => <GameCover key={image.id} src={image.url ?? image.path} alt={image.caption ?? details.item.title} size="card" />)}</div> : <EmptyState icon={Images} title="Фотографий пока нет" description="Пользовательские фотографии появятся здесь." />}</Panel>;
  if (tab === "purchases") return <Panel title="Покупки">{details.purchases.length ? <div className="divide-y">{details.purchases.map((purchase) => <div key={purchase.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span><strong>{purchase.shop}</strong><span className="ml-2 text-muted-foreground">{formatDate(purchase.purchaseDate)}</span></span><span>{formatMoney(purchase.totalPrice.amount, purchase.totalPrice.currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Покупки не добавлены.</p>}</Panel>;
  if (tab === "notes") return <Panel title="Заметки">{details.notes.length ? <div className="grid gap-3">{details.notes.map((note) => <article key={note.id} className="rounded-lg border p-4"><h3 className="font-medium">{note.title ?? "Заметка"}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p></article>)}</div> : <p className="text-sm text-muted-foreground">Заметок пока нет.</p>}</Panel>;
  const relations = tab === "expansions" ? details.item.relations.filter(({ relationType }) => relationType === "expands") : details.item.relations;
  return <Panel title={tab === "expansions" ? "Дополнения" : "Связанные Item"}>{relations.length ? <div className="grid gap-3 sm:grid-cols-2">{relations.map((relation) => <Link key={relation.id} href={`/collection/${relation.relatedItem.id}`} className="flex gap-3 rounded-lg border p-3 hover:bg-[var(--bg-surface-hover)]"><GameCover src={relation.relatedItem.cover?.url ?? relation.relatedItem.cover?.path} alt={relation.relatedItem.title} size="sm" /><span><strong>{relation.relatedItem.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{relation.relationType}</span></span></Link>)}</div> : <p className="text-sm text-muted-foreground">Связей пока нет.</p>}</Panel>;
}

function Taxonomy({ title, values }: { title: string; values: { id: string; name: string }[] }) { if (!values.length) return null; return <div className="mt-5"><h3 className="text-sm font-medium">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{values.map(({ name }) => name).join(", ")}</p></div>; }
function Fact({ icon, label, value }: { icon: React.ReactElement<{ className?: string }>; label: string; value: string }) { return <div className="flex gap-2">{React.cloneElement(icon, { className: "h-5 w-5 text-primary" })}<span><strong className="block">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></span></div>; }
function Summary({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{children}</dd></div>; }
function range(min?: number | null, max?: number | null) { if (!min && !max) return "—"; return min === max ? String(min ?? max) : `${min ?? "?"}–${max ?? "?"}`; }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—"; }
function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
function tabCount(tab: DetailTab, details: CollectionItemDetailDto) { if (tab === "plays") return details.playSummary.count; if (tab === "photos") return details.item.images.length; if (tab === "purchases") return details.purchases.length; if (tab === "notes") return details.notes.length; if (tab === "relations") return details.item.relations.length; if (tab === "expansions") return details.item.relations.filter(({ relationType }) => relationType === "expands").length; return 0; }
