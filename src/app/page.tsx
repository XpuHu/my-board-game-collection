"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Box,
  CalendarDays,
  Camera,
  CirclePlus,
  Clock3,
  Dices,
  Search,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { AddPlayDialog } from "@/components/add-play-dialog";
import { ExpectedDateDialog } from "@/components/expected-date-dialog";
import { GameCover } from "@/components/game-cover";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui-state";
import { dashboardRestAdapter } from "@/features/dashboard/api";
import { quoteForDate } from "@/features/dashboard/content";
import type {
  CollectionCardDto,
  DashboardDto,
  PlayListItemDto,
  PreorderListItemDto,
} from "@/shared/api";
import { useAdapterQuery } from "@/shared/hooks/use-adapter-query";
import { cn } from "@/shared/lib/utils";

import styles from "./page.module.css";

export default function HomePage() {
  const query = useAdapterQuery(dashboardRestAdapter, undefined, {
    key: "dashboard",
  });
  const [playOpen, setPlayOpen] = React.useState(false);
  const [datePreorder, setDatePreorder] =
    React.useState<PreorderListItemDto | null>(null);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Главная"
        className={styles.pageHeader}
        actions={<HeaderActions />}
      />

      <section className={styles.dashboard} aria-label="Сводка по коллекции">
        {query.isLoading ? (
          <LoadingState
            className={styles.dashboardState}
            title="Загружаем главную"
            description="Собираем партии, предзаказы и статистику."
          />
        ) : null}
        {query.error ? (
          <ErrorState
            className={styles.dashboardState}
            description={query.error}
            onRetry={query.reload}
          />
        ) : null}
        {query.data ? (
          <DashboardPanels data={query.data} onChangeDate={setDatePreorder} />
        ) : null}

        <QuickActionsPanel onAddPlay={() => setPlayOpen(true)} />
        <QuotePanel
          imageUrl={
            query.data?.recentlyAdded
              .map(({ item }) => coverSource(item.cover))
              .find(Boolean) ?? null
          }
        />
      </section>

      {playOpen ? (
        <AddPlayDialog
          open={playOpen}
          onOpenChange={setPlayOpen}
          onSaved={query.reload}
        />
      ) : null}
      {datePreorder ? (
        <ExpectedDateDialog
          preorder={datePreorder}
          open
          onOpenChange={(open) => {
            if (!open) setDatePreorder(null);
          }}
          onSaved={query.reload}
        />
      ) : null}
    </main>
  );
}

function HeaderActions() {
  return (
    <>
      <Button
        asChild
        size="icon"
        variant="outline"
        className={styles.headerButton}
      >
        <Link href="/collection" aria-label="Поиск по коллекции">
          <Search aria-hidden="true" />
        </Link>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(styles.headerButton, styles.notificationButton)}
        aria-label="Уведомления: 3 новых"
      >
        <Bell aria-hidden="true" />
        <span className={styles.notificationBadge} aria-hidden="true">
          3
        </span>
      </Button>
    </>
  );
}

function DashboardPanels({
  data,
  onChangeDate,
}: {
  data: DashboardDto;
  onChangeDate: (preorder: PreorderListItemDto) => void;
}) {
  return (
    <>
      <RecentPlaysPanel plays={data.recentPlays} />
      <UpcomingPreordersPanel
        preorders={data.upcomingPreorders}
        onChangeDate={onChangeDate}
      />
      <RecentlyAddedPanel items={data.recentlyAdded} />
      <MonthStatisticsPanel summary={data.monthSummary} />
      <FavoriteGamePanel favorite={data.favoriteItem} />
      <ActivityPanel activity={data.activity} />
    </>
  );
}

function PanelAction({ href }: { href: string }) {
  return (
    <Link href={href} className={styles.panelAction}>
      Смотреть все
    </Link>
  );
}

function RecentPlaysPanel({ plays }: { plays: PlayListItemDto[] }) {
  return (
    <Panel
      title="Последние партии"
      action={<PanelAction href="/plays" />}
      className={cn(styles.panel, styles.recentPlaysPanel)}
    >
      {plays.length ? (
        <div className={styles.recentPlays}>
          {plays.map((play) => (
            <Link
              key={play.id}
              href={`/plays?itemId=${encodeURIComponent(play.item.id)}`}
              className={styles.recentPlay}
            >
              <GameCover
                src={coverSource(play.item.cover)}
                alt={play.item.cover?.alt ?? play.item.title}
                size="sm"
                className="!h-[76px] !w-[76px] !rounded-md"
              />
              <span className={styles.recentPlayContent}>
                <span className={styles.recentPlayHeading}>
                  <strong title={play.item.title}>{play.item.title}</strong>
                  <time dateTime={play.playedAt}>
                    {formatRelativeDate(play.playedAt)}
                  </time>
                </span>
                <span className={styles.playMeta}>
                  <span>
                    <Users aria-hidden="true" />
                    {formatPlayers(play.playersCount)}
                  </span>
                  <span>
                    <Clock3 aria-hidden="true" />
                    {play.durationMinutes
                      ? `${play.durationMinutes} мин`
                      : "Без времени"}
                  </span>
                  {play.result === "win" ? (
                    <StatusBadge
                      variant="success"
                      className={styles.resultBadge}
                    >
                      Победа
                    </StatusBadge>
                  ) : null}
                  {play.result === "loss" ? (
                    <StatusBadge
                      variant="danger"
                      className={styles.resultBadge}
                    >
                      Поражение
                    </StatusBadge>
                  ) : null}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <CompactEmpty
          icon={CalendarDays}
          title="Партий пока нет"
          description="Добавьте первую сыгранную партию."
        />
      )}
    </Panel>
  );
}

function UpcomingPreordersPanel({
  preorders,
  onChangeDate,
}: {
  preorders: PreorderListItemDto[];
  onChangeDate: (preorder: PreorderListItemDto) => void;
}) {
  return (
    <Panel
      title="Ближайшие предзаказы"
      action={<PanelAction href="/preorders" />}
      className={cn(styles.panel, styles.preordersPanel)}
    >
      {preorders.length ? (
        <div className={styles.preorders}>
          {preorders.map((preorder) => {
            const calendarMonth = calendarMonthName(preorder.expectedDate);

            return (
              <article className={styles.preorder} key={preorder.id}>
                <div className={styles.preorderCalendar} aria-hidden="true">
                  <strong>{calendarMonth}</strong>
                </div>
                <GameCover
                  src={coverSource(preorder.item.cover)}
                  alt={preorder.item.cover?.alt ?? preorder.item.title}
                  size="md"
                  className="!h-[108px] !w-[92px] !rounded-md"
                />
                <div className={styles.preorderContent}>
                  <Link
                    href={`/collection/${preorder.item.id}`}
                    className={styles.preorderTitle}
                  >
                    {preorder.item.title}
                  </Link>
                  <span className={styles.preorderShop}>{preorder.shop}</span>
                  <span className={styles.expectedLabel}>Ожидается</span>
                  <time dateTime={preorder.expectedDate ?? undefined}>
                    {formatExpectedDate(preorder)}
                  </time>
                  <Button
                    type="button"
                    size="sm"
                    className={styles.changeDateButton}
                    onClick={() => onChangeDate(preorder)}
                  >
                    Изменить дату
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <CompactEmpty
          icon={Box}
          title="Нет активных предзаказов"
          description="Новые ожидаемые игры появятся здесь."
        />
      )}
    </Panel>
  );
}

function RecentlyAddedPanel({ items }: { items: CollectionCardDto[] }) {
  return (
    <Panel
      title="Недавно добавленные в коллекцию"
      action={<PanelAction href="/collection" />}
      className={cn(styles.panel, styles.recentlyAddedPanel)}
    >
      {items.length ? (
        <div className={styles.recentlyAdded}>
          {items.map((card) => {
            const imageUrl = coverSource(card.item.cover);
            const score = fivePointRating(
              card.userItem.personalRating ?? card.item.communityRating,
            );

            return (
              <Link
                href={`/collection/${card.item.id}`}
                className={styles.collectionCard}
                key={card.item.id}
              >
                {imageUrl ? (
                  // Provider images can use arbitrary remote domains.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className={styles.cardImage} />
                ) : (
                  <span className={styles.cardFallback} aria-hidden="true">
                    <Dices />
                  </span>
                )}
                <span className={styles.cardGradient} aria-hidden="true" />
                <span className={styles.collectionCardContent}>
                  <strong>{card.item.title}</strong>
                  <time dateTime={card.userItem.ownedAt}>
                    {formatRelativeDate(card.userItem.ownedAt)}
                  </time>
                  <StarScore value={score} />
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <CompactEmpty
          icon={Dices}
          title="Коллекция пуста"
          description="Добавьте первую игру в коллекцию."
        />
      )}
    </Panel>
  );
}

function MonthStatisticsPanel({
  summary,
}: {
  summary: DashboardDto["monthSummary"];
}) {
  const entries = [
    {
      label: "партий",
      value: summary.playsCount,
      icon: Clock3,
      tone: styles.statPurple,
    },
    {
      label: "разных игр",
      value: summary.uniqueItemsCount,
      icon: Users,
      tone: styles.statGreen,
    },
    {
      label: "наиграно",
      value: formatDuration(summary.totalDurationMinutes),
      icon: Clock3,
      tone: styles.statOrange,
    },
    {
      label: "ср. оценка",
      value: fivePointRating(summary.averagePersonalRating)?.toFixed(1) ?? "—",
      icon: Star,
      tone: styles.statBlue,
    },
    {
      label: "побед",
      value: summary.winsCount,
      icon: Trophy,
      tone: styles.statYellow,
    },
  ];

  return (
    <Panel
      title={`Статистика за ${currentMonthName()}`}
      className={cn(styles.panel, styles.statisticsPanel)}
    >
      <div className={styles.statistics}>
        {entries.map(({ label, value, icon: Icon, tone }) => (
          <div className={styles.statistic} key={label}>
            <span className={cn(styles.statIcon, tone)}>
              <Icon aria-hidden="true" />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FavoriteGamePanel({
  favorite,
}: {
  favorite?: CollectionCardDto | null;
}) {
  return (
    <Panel
      title="Любимая игра"
      className={cn(styles.panel, styles.favoritePanel)}
    >
      {favorite ? (
        <Link
          href={`/collection/${favorite.item.id}`}
          className={styles.favoriteGame}
        >
          <GameCover
            src={coverSource(favorite.item.cover)}
            alt={favorite.item.cover?.alt ?? favorite.item.title}
            size="md"
            className="!h-[116px] !w-[92px] !rounded-md"
          />
          <span className={styles.favoriteContent}>
            <strong>{favorite.item.title}</strong>
            <StarScore
              value={fivePointRating(favorite.userItem.personalRating)}
              tone="accent"
            />
            <span>{formatPlaysCount(favorite.plays.count)}</span>
            <span className={styles.favoriteLastPlayed}>
              {favorite.plays.lastPlayedAt
                ? `Последняя партия — ${formatRelativeDate(favorite.plays.lastPlayedAt)}`
                : "Партий ещё не было"}
            </span>
          </span>
        </Link>
      ) : (
        <CompactEmpty
          icon={Star}
          title="Любимая игра не выбрана"
          description="Отметьте игру звездой в коллекции."
        />
      )}
    </Panel>
  );
}

function ActivityPanel({ activity }: { activity: DashboardDto["activity"] }) {
  return (
    <Panel
      title="Активность по дням"
      className={cn(styles.panel, styles.activityPanel)}
    >
      <ActivityHeatmap activity={activity} />
    </Panel>
  );
}

function ActivityHeatmap({ activity }: { activity: DashboardDto["activity"] }) {
  const counts = new Map(
    activity.map(({ date, playsCount }) => [date, playsCount]),
  );
  const columns = activityColumns(counts);
  const maxCount = Math.max(
    1,
    ...columns.flatMap((column) => column.map((day) => day.count)),
  );
  const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className={styles.heatmap}>
      <div className={styles.heatmapColumns} aria-label="Календарь активности">
        {columns.map((column, weekday) => (
          <div className={styles.heatmapColumn} key={weekdayNames[weekday]}>
            <span className={styles.weekday}>{weekdayNames[weekday]}</span>
            <div className={styles.heatCells}>
              {column.map(({ key, count }) => {
                const level = heatLevel(count, maxCount);
                return (
                  <span
                    key={key}
                    title={`${formatFullDate(key)}: ${formatPlaysCount(count)}`}
                    aria-label={`${formatFullDate(key)}: ${formatPlaysCount(count)}`}
                    className={styles.heatCell}
                    data-level={level}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.heatLegend} aria-hidden="true">
        <span>Меньше</span>
        <span className={styles.legendScale}>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <span className={styles.heatCell} data-level={level} key={level} />
          ))}
        </span>
        <span>Больше</span>
      </div>
    </div>
  );
}

function QuickActionsPanel({ onAddPlay }: { onAddPlay: () => void }) {
  return (
    <Panel
      title="Быстрые действия"
      className={cn(styles.panel, styles.quickActionsPanel)}
    >
      <div aria-label="Быстрые действия" className={styles.quickActions}>
        <button
          type="button"
          className={cn(styles.quickAction, styles.quickPurple)}
          onClick={onAddPlay}
        >
          <Dices aria-hidden="true" />
          <span>Добавить партию</span>
        </button>
        <Link
          href="/items/new"
          className={cn(styles.quickAction, styles.quickBlue)}
        >
          <CirclePlus aria-hidden="true" />
          <span>Добавить игру</span>
        </Link>
        <Link
          href="/preorders"
          className={cn(styles.quickAction, styles.quickGreen)}
        >
          <Box aria-hidden="true" />
          <span>Изменить предзаказ</span>
        </Link>
        <Link
          href="/collection"
          className={cn(styles.quickAction, styles.quickAmber)}
        >
          <Camera aria-hidden="true" />
          <span>Добавить фото</span>
        </Link>
      </div>
    </Panel>
  );
}

function QuotePanel({ imageUrl }: { imageUrl?: string | null }) {
  const quote = quoteForDate();

  return (
    <Panel title="Цитата дня" className={cn(styles.panel, styles.quotePanel)}>
      {imageUrl ? (
        // This repeated cover is decorative and intentionally has an empty alt.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className={styles.quoteImage} />
      ) : null}
      {imageUrl ? (
        <span className={styles.quoteFade} aria-hidden="true" />
      ) : null}
      <blockquote className={styles.quote}>
        <span className={styles.quoteMark} aria-hidden="true">
          “
        </span>
        <p>{quote.text}</p>
        <footer>— {quote.author}</footer>
      </blockquote>
    </Panel>
  );
}

function StarScore({
  value,
  tone = "warning",
}: {
  value?: number | null;
  tone?: "warning" | "accent";
}) {
  const normalized = Math.max(0, Math.min(5, value ?? 0));

  return (
    <span
      className={cn(styles.starScore, tone === "accent" && styles.accentStars)}
      aria-label={
        value == null ? "Нет оценки" : `Оценка ${normalized.toFixed(1)} из 5`
      }
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, normalized - index)) * 100;
        return (
          <span className={styles.star} key={index} aria-hidden="true">
            <Star className={styles.starOutline} />
            <span className={styles.starFill} style={{ width: `${fill}%` }}>
              <Star />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function CompactEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.compactEmpty}>
      <Icon aria-hidden />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function coverSource(
  cover?: { url?: string | null; path?: string | null } | null,
) {
  return cover?.url ?? cover?.path ?? null;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);

  if (days === -7) return "неделю назад";
  if (days === -14) return "2 недели назад";
  if (days === -21) return "3 недели назад";
  if (Math.abs(days) <= 30) {
    return new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" }).format(
      days,
      "day",
    );
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatPlayers(value?: number | null) {
  const count = value ?? 0;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "игрок"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "игрока"
        : "игроков";
  return `${count} ${noun}`;
}

function formatPlaysCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "партия"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "партии"
        : "партий";
  return `${count} ${noun}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function currentMonthName() {
  return new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date());
}

function fivePointRating(value?: number | null) {
  if (value == null) return null;
  return value > 5 ? value / 2 : value;
}

function calendarMonthName(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
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
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function activityColumns(counts: Map<string, number>) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const mondayIndex = (today.getDay() + 6) % 7;
  const latestMonday = new Date(today);
  latestMonday.setDate(today.getDate() - mondayIndex);

  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 15 }, (_, week) => {
      const date = new Date(latestMonday);
      date.setDate(latestMonday.getDate() - (14 - week) * 7 + weekday);
      const key = localDateKey(date);
      return { key, count: date > today ? 0 : (counts.get(key) ?? 0) };
    }),
  );
}

function heatLevel(count: number, maxCount: number) {
  if (count <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((count / maxCount) * 5)));
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
