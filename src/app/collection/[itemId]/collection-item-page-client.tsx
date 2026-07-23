"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock3,
  ExternalLink,
  FilePenLine,
  Gamepad2,
  Gauge,
  Heart,
  ImagePlus,
  Images,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import {
  CollectionEditPanels,
  type CollectionEditMode,
} from "@/components/collection-edit-panels";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { ExpectedDateDialog } from "@/components/expected-date-dialog";
import { GameCover } from "@/components/game-cover";
import { OverflowMenu, OverflowMenuItem } from "@/components/overflow-menu";
import { Panel } from "@/components/panel";
import { Rating } from "@/components/rating";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-state";
import { collectionDetailRestAdapter } from "@/features/collection/api";
import { apiRequest } from "@/shared/api/client";
import type {
  CollectionItemDetailDto,
  ImageDto,
  ItemRelationDto,
  PlayListItemDto,
  PreorderListItemDto,
  ProviderCode,
} from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";
import { cn } from "@/shared/lib/utils";

import styles from "./collection-item-page.module.css";

const tabs = [
  "overview",
  "plays",
  "expansions",
  "photos",
  "purchases",
  "notes",
  "details",
] as const;

type DetailTab = (typeof tabs)[number];
type ConfirmAction = "archive" | "remove";

const tabLabels: Record<DetailTab, string> = {
  overview: "Обзор",
  plays: "Партии",
  expansions: "Дополнения",
  photos: "Фото",
  purchases: "Покупки",
  notes: "Заметки",
  details: "Подробнее",
};

export function CollectionItemPageClient({ itemId }: { itemId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const requestedTab = searchParams.get("tab") as DetailTab | null;
  const activeTab =
    requestedTab && tabs.includes(requestedTab) ? requestedTab : "overview";
  const query = useAdapterQuery(
    collectionDetailRestAdapter,
    { itemId },
    { key: itemId },
  );
  const [playOpen, setPlayOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState<CollectionEditMode | null>(
    null,
  );
  const [confirmAction, setConfirmAction] =
    React.useState<ConfirmAction | null>(null);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [expectedDatePreorder, setExpectedDatePreorder] =
    React.useState<PreorderListItemDto | null>(null);
  const [savingAction, setSavingAction] = React.useState<string | null>(null);

  function setTab(tab: DetailTab) {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    const suffix = next.toString();
    router.push(`/collection/${itemId}${suffix ? `?${suffix}` : ""}`);
  }

  async function patchOwner(
    input: Record<string, unknown>,
    successMessage: string,
  ) {
    setSavingAction(successMessage);
    try {
      await apiRequest(`/api/items/${encodeURIComponent(itemId)}/user-item`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      toast({ title: successMessage, variant: "success" });
      query.reload();
    } catch (error) {
      toast({
        title: "Не удалось обновить карточку",
        description: errorMessage(error),
        variant: "error",
      });
    } finally {
      setSavingAction(null);
    }
  }

  async function confirmSecondaryAction() {
    if (!confirmAction) return;
    const input =
      confirmAction === "archive"
        ? { status: "archived" }
        : { owned: false, status: "active" };

    try {
      await apiRequest(`/api/items/${encodeURIComponent(itemId)}/user-item`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      toast({
        title:
          confirmAction === "archive"
            ? "Игра перемещена в архив"
            : "Игра удалена из коллекции",
        variant: "success",
      });
      router.push("/collection");
    } catch (error) {
      toast({
        title: "Не удалось выполнить действие",
        description: errorMessage(error),
        variant: "error",
      });
    }
  }

  if (query.isLoading) {
    return (
      <main className={styles.statePage}>
        <LoadingState
          title="Загружаем карточку"
          description="Получаем компактные данные владельца."
        />
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <main className={styles.statePage}>
        <ErrorState
          description={query.error ?? "Карточка коллекции не найдена"}
          onRetry={query.reload}
        />
      </main>
    );
  }

  const details = query.data;
  const isArchived = details.userItem.lifecycleStatus === "archived";

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/collection">
        <ArrowLeft aria-hidden="true" />
        Моя коллекция
      </Link>

      <section className={styles.hero} aria-labelledby="collection-item-title">
        <div className={styles.coverFrame}>
          <GameCover
            src={details.item.cover?.url ?? details.item.cover?.path}
            alt={details.item.cover?.alt ?? details.item.title}
            size="fill"
          />
        </div>

        <div className={styles.heroMain}>
          <div className={styles.titleRow}>
            <h1 id="collection-item-title">{details.item.title}</h1>
            <span className={styles.typeBadge}>{details.item.type.name}</span>
          </div>
          {heroSubtitle(details) ? (
            <p className={styles.subtitle}>{heroSubtitle(details)}</p>
          ) : null}

          <div className={styles.primaryFacts}>
            <Fact
              icon={Users}
              label="Игроки"
              value={range(details.item.minPlayers, details.item.maxPlayers)}
            />
            <Fact
              icon={Clock3}
              label="Длительность"
              value={range(
                details.item.minPlayTime,
                details.item.maxPlayTime,
                " мин",
              )}
            />
            <Fact
              icon={Gauge}
              label="Сложность"
              value={
                details.item.complexity != null
                  ? `${details.item.complexity.toFixed(1)} / 5`
                  : "—"
              }
            />
          </div>

          <ProviderRatings details={details} />
        </div>

        <aside className={styles.ownerPanel} aria-label="Личные данные">
          <div className={styles.heroActions}>
            <Button
              type="button"
              className={styles.addPlayButton}
              disabled={isArchived}
              onClick={() => setPlayOpen(true)}
              title={
                isArchived
                  ? "Верните игру из архива, чтобы добавлять партии"
                  : undefined
              }
            >
              <CalendarPlus aria-hidden="true" />
              Добавить партию
            </Button>
            <OverflowMenu>
              <OverflowMenuItem onClick={() => setEditMode("owner")}>
                <Pencil aria-hidden="true" className={styles.menuIcon} />
                Личные данные
              </OverflowMenuItem>
              <OverflowMenuItem onClick={() => setEditMode("reference")}>
                <FilePenLine aria-hidden="true" className={styles.menuIcon} />
                Справочные данные
              </OverflowMenuItem>
              <OverflowMenuItem
                disabled={savingAction != null}
                onClick={() =>
                  patchOwner(
                    {
                      status:
                        details.userItem.lifecycleStatus === "for_sale"
                          ? "active"
                          : "for_sale",
                    },
                    details.userItem.lifecycleStatus === "for_sale"
                      ? "Игра возвращена в активные"
                      : "Игра отмечена для продажи",
                  )
                }
              >
                <RotateCcw aria-hidden="true" className={styles.menuIcon} />
                {details.userItem.lifecycleStatus === "for_sale"
                  ? "Вернуть в активные"
                  : "Отметить «На продажу»"}
              </OverflowMenuItem>
              <OverflowMenuItem onClick={() => setConfirmAction("archive")}>
                <Archive aria-hidden="true" className={styles.menuIcon} />
                Архивировать
              </OverflowMenuItem>
              <OverflowMenuItem
                className={styles.dangerMenuItem}
                onClick={() => setConfirmAction("remove")}
              >
                <Trash2 aria-hidden="true" className={styles.menuIcon} />
                Удалить из коллекции
              </OverflowMenuItem>
            </OverflowMenu>
          </div>

          <dl className={styles.ownerSummary}>
            <Summary label="Наличие">
              <StatusBadge variant="success">В коллекции</StatusBadge>
            </Summary>
            <Summary label="Статус">
              <StatusBadge
                variant={lifecycleStatus(details.userItem.lifecycleStatus).tone}
              >
                {lifecycleStatus(details.userItem.lifecycleStatus).label}
              </StatusBadge>
            </Summary>
            <Summary label="Добавлена">
              {formatDate(details.userItem.ownedAt)}
            </Summary>
            <Summary label="Моя оценка">
              <Rating
                value={
                  details.userItem.personalRating != null
                    ? details.userItem.personalRating / 2
                    : null
                }
                label={
                  details.userItem.personalRating != null
                    ? `Личная оценка: ${details.userItem.personalRating} из 10`
                    : "Без личной оценки"
                }
                tone="accent"
                size="md"
              />
            </Summary>
          </dl>

          <div className={styles.ownerFooter}>
            <button
              type="button"
              className={cn(
                styles.favoriteButton,
                details.userItem.favorite && styles.favoriteActive,
              )}
              disabled={savingAction != null}
              aria-pressed={details.userItem.favorite}
              onClick={() =>
                patchOwner(
                  { favorite: !details.userItem.favorite },
                  details.userItem.favorite
                    ? "Удалено из избранного"
                    : "Добавлено в избранное",
                )
              }
            >
              <Heart aria-hidden="true" />
              {details.userItem.favorite ? "В избранном" : "В избранное"}
            </button>
            <TagList
              tags={details.userItem.tags}
              onEdit={() => setEditMode("owner")}
            />
          </div>
        </aside>
      </section>

      <TabBar activeTab={activeTab} details={details} onSelect={setTab} />

      <DetailContent
        tab={activeTab}
        details={details}
        onAddPlay={() => setPlayOpen(true)}
        onEditOwner={() => setEditMode("owner")}
        onEditReference={() => setEditMode("reference")}
        onAddPhoto={() => setPhotoOpen(true)}
        onEditExpectedDate={setExpectedDatePreorder}
      />

      {playOpen ? (
        <AddPlayDialog
          open={playOpen}
          onOpenChange={setPlayOpen}
          initialItemId={details.item.id}
          initialItemTitle={details.item.title}
          onSaved={query.reload}
        />
      ) : null}

      {editMode ? (
        <CollectionEditPanels
          details={details}
          mode={editMode}
          open
          onOpenChange={(open) => {
            if (!open) setEditMode(null);
          }}
          onSaved={(status) => {
            if (status === "sold" || status === "archived") {
              router.push("/collection");
              return;
            }
            query.reload();
          }}
        />
      ) : null}

      <ExpectedDateDialog
        preorder={expectedDatePreorder}
        open={expectedDatePreorder != null}
        onOpenChange={(open) => {
          if (!open) setExpectedDatePreorder(null);
        }}
        onSaved={query.reload}
      />

      <PhotoDialog
        details={details}
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        onSaved={query.reload}
      />

      <ConfirmationDialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction === "archive"
            ? "Архивировать игру?"
            : "Удалить игру из коллекции?"
        }
        description={
          confirmAction === "archive"
            ? "Игра исчезнет из основной коллекции. История партий и справочные данные сохранятся."
            : "Игра исчезнет из коллекции, но связанные данные останутся в базе. Это не удаляет справочную карточку."
        }
        confirmLabel={
          confirmAction === "archive" ? "Архивировать" : "Удалить из коллекции"
        }
        destructive
        onConfirm={confirmSecondaryAction}
      />
    </main>
  );
}

function TabBar({
  activeTab,
  details,
  onSelect,
}: {
  activeTab: DetailTab;
  details: CollectionItemDetailDto;
  onSelect: (tab: DetailTab) => void;
}) {
  function onKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onSelect(nextTab);
    document.getElementById(`collection-tab-${nextTab}`)?.focus();
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Разделы карточки">
      {tabs.map((tab, index) => {
        const count = tabCount(tab, details);
        return (
          <button
            key={tab}
            id={`collection-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="collection-tab-panel"
            tabIndex={activeTab === tab ? 0 : -1}
            className={cn(styles.tab, activeTab === tab && styles.tabActive)}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tabLabels[tab]}
            {count != null ? (
              <span className={styles.tabCount}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DetailContent({
  tab,
  details,
  onAddPlay,
  onEditOwner,
  onEditReference,
  onAddPhoto,
  onEditExpectedDate,
}: {
  tab: DetailTab;
  details: CollectionItemDetailDto;
  onAddPlay: () => void;
  onEditOwner: () => void;
  onEditReference: () => void;
  onAddPhoto: () => void;
  onEditExpectedDate: (preorder: PreorderListItemDto) => void;
}) {
  let content: React.ReactNode;

  if (tab === "overview") {
    content = (
      <Overview
        details={details}
        onAddPlay={onAddPlay}
        onEditOwner={onEditOwner}
        onAddPhoto={onAddPhoto}
        onEditExpectedDate={onEditExpectedDate}
      />
    );
  } else if (tab === "plays") {
    content = <PlaysTab details={details} onAddPlay={onAddPlay} />;
  } else if (tab === "expansions") {
    content = (
      <RelationsTab
        title="Дополнения"
        relations={expansions(details)}
        emptyTitle="Дополнений пока нет"
      />
    );
  } else if (tab === "photos") {
    content = <PhotosTab details={details} onAddPhoto={onAddPhoto} />;
  } else if (tab === "purchases") {
    content = <PurchasesTab details={details} />;
  } else if (tab === "notes") {
    content = <NotesTab details={details} onEditOwner={onEditOwner} />;
  } else {
    content = (
      <DetailsTab details={details} onEditReference={onEditReference} />
    );
  }

  return (
    <div
      id="collection-tab-panel"
      role="tabpanel"
      aria-labelledby={`collection-tab-${tab}`}
      className={styles.tabPanel}
    >
      {content}
    </div>
  );
}

function Overview({
  details,
  onAddPlay,
  onEditOwner,
  onAddPhoto,
  onEditExpectedDate,
}: {
  details: CollectionItemDetailDto;
  onAddPlay: () => void;
  onEditOwner: () => void;
  onAddPhoto: () => void;
  onEditExpectedDate: (preorder: PreorderListItemDto) => void;
}) {
  const activePreorder = details.preorders.find(
    ({ uiStatus }) => uiStatus === "active" || uiStatus === "delayed",
  );
  const latestPurchase = details.purchases[0];
  const previewNote = latestNote(details);
  const itemExpansions = expansions(details).slice(0, 3);
  const photos = details.item.images.slice(0, 4);

  return (
    <div className={styles.overviewGrid}>
      <Panel title="Моя коллекция" className={styles.overviewPanel}>
        <dl className={styles.metricList}>
          <Summary label="Добавлена">
            {formatDate(details.userItem.ownedAt)}
          </Summary>
          <Summary label="Всего партий">{details.playSummary.count}</Summary>
          <Summary label="Последняя партия">
            {formatDate(details.playSummary.lastPlayedAt)}
          </Summary>
          <Summary label="Общее время">
            {formatDuration(details.playSummary.totalDurationMinutes)}
          </Summary>
        </dl>
        <Button asChild variant="outline" className={styles.panelButton}>
          <Link
            href={`/statistics?itemId=${encodeURIComponent(details.item.id)}`}
          >
            <Trophy aria-hidden="true" />
            Статистика игры
          </Link>
        </Button>
      </Panel>

      <Panel
        title="Последние партии"
        className={cn(styles.overviewPanel, styles.recentPanel)}
      >
        {details.recentPlays.length ? (
          <div className={styles.playList}>
            {details.recentPlays.slice(0, 3).map((play) => (
              <PlayRow key={play.id} play={play} />
            ))}
          </div>
        ) : (
          <CompactEmpty
            icon={Gamepad2}
            title="Вы ещё не играли"
            description="Добавьте первую партию, чтобы начать историю игры."
            action={
              <Button type="button" size="sm" onClick={onAddPlay}>
                <Plus aria-hidden="true" />
                Добавить первую партию
              </Button>
            }
          />
        )}
        {details.recentPlays.length ? (
          <Button asChild variant="ghost" className={styles.panelLink}>
            <Link href={`/plays?itemId=${encodeURIComponent(details.item.id)}`}>
              Все партии ({details.playSummary.count})
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </Panel>

      {latestPurchase || activePreorder ? (
        <div className={styles.stackColumn}>
          {latestPurchase ? (
            <Panel title="Покупка" className={styles.overviewPanel}>
              <dl className={styles.metricList}>
                <Summary label="Магазин">{latestPurchase.shop}</Summary>
                <Summary label="Дата">
                  {formatDate(latestPurchase.purchaseDate)}
                </Summary>
                <Summary label="Итого">
                  {formatMoney(
                    latestPurchase.totalPrice.amount,
                    latestPurchase.totalPrice.currency,
                  )}
                </Summary>
              </dl>
              <Button asChild variant="ghost" className={styles.panelLink}>
                <Link href={`/collection/${details.item.id}?tab=purchases`}>
                  Все покупки ({details.purchases.length})
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            </Panel>
          ) : null}
          {activePreorder ? (
            <Panel title="Активный предзаказ" className={styles.overviewPanel}>
              <div className={styles.preorderTitleRow}>
                <strong>{activePreorder.item.title}</strong>
                <StatusBadge
                  variant={
                    activePreorder.uiStatus === "delayed" ? "warning" : "info"
                  }
                >
                  {preorderStatusLabel(activePreorder)}
                </StatusBadge>
              </div>
              <dl className={styles.metricList}>
                <Summary label="Ожидается">
                  {formatExpectedDate(activePreorder)}
                </Summary>
                <Summary label="Магазин">{activePreorder.shop}</Summary>
              </dl>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={styles.panelButton}
                onClick={() => onEditExpectedDate(activePreorder)}
              >
                <CalendarDays aria-hidden="true" />
                Изменить дату
              </Button>
            </Panel>
          ) : null}
        </div>
      ) : null}

      <Panel title="Заметки" className={styles.overviewPanel}>
        {previewNote ? (
          <>
            <p className={styles.notePreview}>{previewNote.body}</p>
            {previewNote.updatedAt ? (
              <span className={styles.noteDate}>
                Обновлено {formatDate(previewNote.updatedAt)}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className={styles.panelLink}
              onClick={onEditOwner}
            >
              Редактировать заметку
              <Pencil aria-hidden="true" />
            </Button>
          </>
        ) : (
          <CompactEmpty
            icon={FilePenLine}
            title="Заметок пока нет"
            description="Сохраните впечатления, правила или важные детали."
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEditOwner}
              >
                <Plus aria-hidden="true" />
                Добавить заметку
              </Button>
            }
          />
        )}
      </Panel>

      <Panel title="Дополнения" className={styles.overviewPanel}>
        {itemExpansions.length ? (
          <div className={styles.expansionList}>
            {itemExpansions.map((relation) => (
              <RelationRow key={relation.id} relation={relation} />
            ))}
          </div>
        ) : (
          <CompactEmpty
            icon={Gamepad2}
            title="Дополнений пока нет"
            description="Связанные дополнения появятся в этом блоке."
          />
        )}
        {itemExpansions.length ? (
          <Button asChild variant="ghost" className={styles.panelLink}>
            <Link href={`/collection/${details.item.id}?tab=expansions`}>
              Все дополнения ({expansions(details).length})
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </Panel>

      <Panel title="Фотографии" className={styles.overviewPanel}>
        <div className={styles.photoPreviewGrid}>
          {photos.map((image) => (
            <Photo key={image.id} image={image} title={details.item.title} />
          ))}
          <button
            type="button"
            className={styles.addPhotoTile}
            onClick={onAddPhoto}
          >
            <ImagePlus aria-hidden="true" />
            Добавить фото
          </button>
        </div>
        {details.item.images.length ? (
          <Button asChild variant="ghost" className={styles.panelLink}>
            <Link href={`/collection/${details.item.id}?tab=photos`}>
              Все фото ({details.item.images.length})
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </Panel>
    </div>
  );
}

function PlaysTab({
  details,
  onAddPlay,
}: {
  details: CollectionItemDetailDto;
  onAddPlay: () => void;
}) {
  return (
    <Panel
      title="История партий"
      action={
        <Button type="button" size="sm" onClick={onAddPlay}>
          <CalendarPlus aria-hidden="true" />
          Добавить
        </Button>
      }
    >
      {details.recentPlays.length ? (
        <>
          <div className={styles.playList}>
            {details.recentPlays.map((play) => (
              <PlayRow key={play.id} play={play} expanded />
            ))}
          </div>
          <Button asChild variant="outline" className={styles.panelButton}>
            <Link href={`/plays?itemId=${encodeURIComponent(details.item.id)}`}>
              Открыть полную историю
            </Link>
          </Button>
        </>
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Партий пока нет"
          description="Добавьте первую партию для этой игры."
          primaryAction={
            <Button type="button" onClick={onAddPlay}>
              Добавить партию
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function RelationsTab({
  title,
  relations,
  emptyTitle,
}: {
  title: string;
  relations: ItemRelationDto[];
  emptyTitle: string;
}) {
  return (
    <Panel title={title}>
      {relations.length ? (
        <div className={styles.relationGrid}>
          {relations.map((relation) => (
            <RelationRow key={relation.id} relation={relation} expanded />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Gamepad2}
          title={emptyTitle}
          description="Связанные элементы появятся здесь."
        />
      )}
    </Panel>
  );
}

function PhotosTab({
  details,
  onAddPhoto,
}: {
  details: CollectionItemDetailDto;
  onAddPhoto: () => void;
}) {
  return (
    <Panel
      title="Фотографии"
      action={
        <Button type="button" size="sm" onClick={onAddPhoto}>
          <ImagePlus aria-hidden="true" />
          Добавить
        </Button>
      }
    >
      {details.item.images.length ? (
        <div className={styles.photoGallery}>
          {details.item.images.map((image) => (
            <Photo key={image.id} image={image} title={details.item.title} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Images}
          title="Фотографий пока нет"
          description="Добавьте фотографию коробки, компонентов или партии."
          primaryAction={
            <Button type="button" onClick={onAddPhoto}>
              Добавить фото
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function PurchasesTab({ details }: { details: CollectionItemDetailDto }) {
  return (
    <Panel title="Покупки">
      {details.purchases.length ? (
        <div className={styles.purchaseList}>
          {details.purchases.map((purchase) => (
            <article key={purchase.id} className={styles.purchaseRow}>
              <div>
                <strong>{purchase.shop}</strong>
                <span>{formatDate(purchase.purchaseDate)}</span>
              </div>
              <strong>
                {formatMoney(
                  purchase.totalPrice.amount,
                  purchase.totalPrice.currency,
                )}
              </strong>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingBag}
          title="Покупки не добавлены"
          description="История покупок этой игры появится здесь."
        />
      )}
    </Panel>
  );
}

function NotesTab({
  details,
  onEditOwner,
}: {
  details: CollectionItemDetailDto;
  onEditOwner: () => void;
}) {
  const notes = [
    ...(details.userItem.notes
      ? [
          {
            id: "owner-note",
            title: "Личная заметка",
            body: details.userItem.notes,
            updatedAt: null,
          },
        ]
      : []),
    ...details.notes,
  ];

  return (
    <Panel
      title="Заметки"
      action={
        <Button type="button" size="sm" onClick={onEditOwner}>
          <Pencil aria-hidden="true" />
          Редактировать
        </Button>
      }
    >
      {notes.length ? (
        <div className={styles.noteList}>
          {notes.map((note) => (
            <article key={note.id} className={styles.noteCard}>
              <div className={styles.noteCardHeader}>
                <h3>{note.title ?? "Заметка"}</h3>
                {note.updatedAt ? (
                  <span>{formatDate(note.updatedAt)}</span>
                ) : null}
              </div>
              <p>{note.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FilePenLine}
          title="Заметок пока нет"
          description="Добавьте личную заметку об игре."
          primaryAction={
            <Button type="button" onClick={onEditOwner}>
              Добавить заметку
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function DetailsTab({
  details,
  onEditReference,
}: {
  details: CollectionItemDetailDto;
  onEditReference: () => void;
}) {
  return (
    <div className={styles.detailsGrid}>
      <Panel
        title="Об игре"
        className={styles.descriptionPanel}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onEditReference}
          >
            <Pencil aria-hidden="true" />
            Редактировать
          </Button>
        }
      >
        <p className={styles.description}>
          {details.item.description ?? "Описание пока не добавлено."}
        </p>
      </Panel>

      <Panel title="Характеристики">
        <dl className={styles.metricList}>
          <Summary label="Год">{details.item.year ?? "—"}</Summary>
          <Summary label="Возраст">
            {details.item.minAge != null ? `${details.item.minAge}+` : "—"}
          </Summary>
          <Summary label="Игроки">
            {range(details.item.minPlayers, details.item.maxPlayers)}
          </Summary>
          <Summary label="Длительность">
            {range(details.item.minPlayTime, details.item.maxPlayTime, " мин")}
          </Summary>
          <Summary label="Сложность">
            {details.item.complexity != null
              ? `${details.item.complexity.toFixed(1)} / 5`
              : "—"}
          </Summary>
        </dl>
      </Panel>

      <TaxonomyPanel title="Механики" values={details.item.mechanics} />
      <TaxonomyPanel title="Категории" values={details.item.categories} />
      <TaxonomyPanel title="Дизайнеры" values={details.item.designers} />
      <TaxonomyPanel title="Художники" values={details.item.artists} />
      <TaxonomyPanel title="Издатели" values={details.item.publishers} />

      <RelationsTab
        title="Связи"
        relations={details.item.relations}
        emptyTitle="Связей пока нет"
      />
    </div>
  );
}

function ProviderRatings({ details }: { details: CollectionItemDetailDto }) {
  const sources = providerSources(details);
  if (!sources.length) return null;

  return (
    <div className={styles.providerRatings} aria-label="Рейтинги источников">
      {sources.map((source) => {
        const content = (
          <>
            <span>{source.label}</span>
            <strong>
              {source.rating != null ? `${source.rating.toFixed(1)} / 10` : "—"}
            </strong>
            {source.url ? <ExternalLink aria-hidden="true" /> : null}
          </>
        );

        return source.url ? (
          <a
            key={source.code}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className={styles.providerLink}
            aria-label={`Открыть ${details.item.title} на ${source.fullLabel}`}
          >
            {content}
          </a>
        ) : (
          <div key={source.code} className={styles.providerLink}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.fact}>
      <Icon aria-hidden />
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function Summary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.summary}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TagList({
  tags,
  onEdit,
}: {
  tags: { id: string; name: string }[];
  onEdit: () => void;
}) {
  if (!tags.length) {
    return (
      <button type="button" className={styles.addTagsButton} onClick={onEdit}>
        <Tag aria-hidden="true" />
        Добавить теги
      </button>
    );
  }

  return (
    <div className={styles.tagList} aria-label="Пользовательские теги">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag.id}>{tag.name}</span>
      ))}
      {tags.length > 3 ? <span>+{tags.length - 3}</span> : null}
    </div>
  );
}

function PlayRow({
  play,
  expanded = false,
}: {
  play: PlayListItemDto;
  expanded?: boolean;
}) {
  const result = playResult(play.result);
  return (
    <article className={styles.playRow}>
      <div className={styles.playDate}>
        <strong>{formatDate(play.playedAt)}</strong>
        {play.scenario ? <span>{play.scenario}</span> : null}
      </div>
      <div className={styles.playMeta}>
        <span>
          <Users aria-hidden="true" />
          {play.playersCount ?? "—"}
        </span>
        <span>
          <Clock3 aria-hidden="true" />
          {play.durationMinutes ? `${play.durationMinutes} мин` : "—"}
        </span>
        {expanded && play.playerNames.length ? (
          <span className={styles.playerNames}>
            {play.playerNames.join(", ")}
          </span>
        ) : null}
      </div>
      <div className={styles.playResult}>
        {play.score ? <span className={styles.score}>{play.score}</span> : null}
        <StatusBadge variant={result.tone}>{result.label}</StatusBadge>
      </div>
    </article>
  );
}

function RelationRow({
  relation,
  expanded = false,
}: {
  relation: ItemRelationDto;
  expanded?: boolean;
}) {
  return (
    <Link
      href={`/collection/${relation.relatedItem.id}`}
      className={cn(styles.relationRow, expanded && styles.relationRowExpanded)}
    >
      <GameCover
        src={
          relation.relatedItem.cover?.url ?? relation.relatedItem.cover?.path
        }
        alt={relation.relatedItem.cover?.alt ?? relation.relatedItem.title}
        size="sm"
        className={styles.relationCover}
      />
      <span>
        <strong>{relation.relatedItem.title}</strong>
        <small>{relationLabel(relation.relationType)}</small>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

function Photo({ image, title }: { image: ImageDto; title: string }) {
  return (
    <button
      type="button"
      className={styles.photo}
      aria-label={`Открыть фотографию: ${image.caption ?? title}`}
    >
      <GameCover
        src={image.url ?? image.path}
        alt={image.caption ?? title}
        size="fill"
      />
    </button>
  );
}

function CompactEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.compactEmpty}>
      <Icon aria-hidden />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

function TaxonomyPanel({
  title,
  values,
}: {
  title: string;
  values: { id: string; name: string }[];
}) {
  if (!values.length) return null;

  return (
    <Panel title={title}>
      <div className={styles.taxonomyList}>
        {values.map((value) => (
          <span key={value.id}>{value.name}</span>
        ))}
      </div>
    </Panel>
  );
}

function PhotoDialog({
  details,
  open,
  onOpenChange,
  onSaved,
}: {
  details: CollectionItemDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    const caption = String(form.get("caption") ?? "").trim();
    setSaving(true);

    try {
      await apiRequest(
        `/api/items/${encodeURIComponent(details.item.id)}/images`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "user",
            provider: "manual",
            url,
            caption: caption || null,
          }),
        },
      );
      toast({ title: "Фотография добавлена", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "Не удалось добавить фотографию",
        description: errorMessage(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить фотографию</DialogTitle>
          <DialogDescription>
            Укажите прямую ссылку на фотографию игры.
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={submit}>
          <DialogBody className="grid gap-4">
            <div>
              <Label htmlFor="photo-url">URL изображения</Label>
              <Input
                id="photo-url"
                name="url"
                type="url"
                className="mt-2"
                required
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div>
              <Label htmlFor="photo-caption">Подпись</Label>
              <Input
                id="photo-caption"
                name="caption"
                className="mt-2"
                placeholder="Компоненты после раскладки"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              <ImagePlus aria-hidden="true" />
              {saving ? "Добавляем" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function heroSubtitle(details: CollectionItemDetailDto) {
  if (
    details.item.originalTitle &&
    details.item.originalTitle !== details.item.title
  ) {
    return details.item.originalTitle;
  }
  if (!details.item.description) return null;
  return details.item.description.split(/\n|(?<=[.!?])\s/)[0];
}

function range(min?: number | null, max?: number | null, suffix = "") {
  if (min == null && max == null) return "—";
  if (min === max) return `${min ?? max}${suffix}`;
  return `${min ?? "?"}–${max ?? "?"}${suffix}`;
}

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—";
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function lifecycleStatus(status: string): {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  if (status === "for_sale") return { label: "На продажу", tone: "warning" };
  if (status === "sold") return { label: "Продана", tone: "danger" };
  if (status === "archived") return { label: "Архивирована", tone: "neutral" };
  return { label: "Активна", tone: "success" };
}

function playResult(result?: string | null): {
  label: string;
  tone: "success" | "danger" | "info" | "neutral";
} {
  if (result === "win") return { label: "Победа", tone: "success" };
  if (result === "loss") return { label: "Поражение", tone: "danger" };
  if (result === "score") return { label: "Счёт", tone: "info" };
  return { label: "Без результата", tone: "neutral" };
}

function relationLabel(type: ItemRelationDto["relationType"]) {
  const labels: Record<ItemRelationDto["relationType"], string> = {
    requires: "Требует",
    expands: "Дополнение",
    compatible_with: "Совместимо",
    contains: "Содержит",
    part_of: "Часть",
    localized_version_of: "Локализованная версия",
    alternative_to: "Альтернатива",
    related: "Связано",
  };
  return labels[type];
}

function tabCount(tab: DetailTab, details: CollectionItemDetailDto) {
  if (tab === "plays") return details.playSummary.count;
  if (tab === "photos") return details.item.images.length;
  if (tab === "purchases") return details.purchases.length;
  if (tab === "notes")
    return details.notes.length + (details.userItem.notes ? 1 : 0);
  if (tab === "expansions") return expansions(details).length;
  return null;
}

function expansions(details: CollectionItemDetailDto) {
  return details.item.relations.filter(
    ({ relationType }) => relationType === "expands",
  );
}

function latestNote(details: CollectionItemDetailDto) {
  if (details.userItem.notes) {
    return {
      body: details.userItem.notes,
      updatedAt: null as string | null,
    };
  }
  if (!details.notes.length) return null;
  const note = [...details.notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
  return { body: note.body, updatedAt: note.updatedAt };
}

function preorderStatusLabel(preorder: PreorderListItemDto) {
  if (preorder.uiStatus === "delayed") return "Задерживается";
  if (preorder.uiStatus === "received") return "Получен";
  if (preorder.uiStatus === "cancelled") return "Отменён";
  return "Активный";
}

function formatExpectedDate(preorder: PreorderListItemDto) {
  if (!preorder.expectedDate || preorder.expectedDatePrecision === "unknown") {
    return "Дата неизвестна";
  }
  const date = new Date(preorder.expectedDate);
  if (preorder.expectedDatePrecision === "quarter") {
    return `${Math.floor(date.getUTCMonth() / 3) + 1}-й квартал ${date.getUTCFullYear()}`;
  }
  if (preorder.expectedDatePrecision === "month") {
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  return formatDate(preorder.expectedDate);
}

function providerSources(details: CollectionItemDetailDto) {
  const providers: {
    code: Exclude<ProviderCode, "manual">;
    label: string;
    fullLabel: string;
    host: string;
  }[] = [
    {
      code: "boardgamegeek",
      label: "BGG",
      fullLabel: "BoardGameGeek",
      host: "boardgamegeek.com",
    },
    {
      code: "tesera",
      label: "Tesera",
      fullLabel: "Tesera",
      host: "tesera.ru",
    },
    {
      code: "nastolio",
      label: "Nastolio",
      fullLabel: "Nastolio",
      host: "nastol.io",
    },
  ];
  const primaryProvider = details.item.externalReferences[0]?.provider;

  return providers.flatMap((provider) => {
    const reference = details.item.externalReferences.find(
      ({ provider: code }) => code === provider.code,
    );
    const link = details.item.links.find(({ url }) =>
      url.toLowerCase().includes(provider.host),
    );
    const url = reference?.url ?? link?.url ?? null;
    const rating =
      primaryProvider === provider.code ? details.item.communityRating : null;
    if (!url && rating == null) return [];
    return [{ ...provider, url, rating }];
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
