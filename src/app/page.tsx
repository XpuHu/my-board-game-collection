import Link from "next/link";
import type { ReactNode } from "react";
import {
  Box,
  Camera,
  Clock3,
  Cuboid,
  PlusCircle,
  Quote,
  Star,
  Trophy,
  Users,
} from "lucide-react";

const recentPlays = [
  {
    title: "Spirit Island",
    players: "2 игрока",
    time: "95 мин",
    result: "Победа",
    date: "вчера",
    cover: "from-cyan-500 via-emerald-500 to-amber-400",
  },
  {
    title: "Ark Nova",
    players: "3 игрока",
    time: "120 мин",
    result: "Победа",
    date: "3 дня назад",
    cover: "from-emerald-300 via-sky-500 to-lime-600",
  },
  {
    title: "Gloomhaven",
    players: "4 игрока",
    time: "150 мин",
    result: "Поражение",
    date: "5 дней назад",
    cover: "from-orange-500 via-stone-800 to-red-950",
  },
  {
    title: "Brass: Birmingham",
    players: "2 игрока",
    time: "90 мин",
    result: "Победа",
    date: "неделю назад",
    cover: "from-slate-300 via-stone-700 to-zinc-950",
  },
];

const preorders = [
  {
    day: "15",
    month: "авг.",
    title: "Frosthaven",
    platform: "CrowdRepublic",
    expected: "15 августа 2025",
    cover: "from-slate-200 via-slate-600 to-slate-950",
  },
  {
    day: "10",
    month: "сент.",
    title: "Nemesis: Retaliation",
    platform: "Gamefound",
    expected: "10 сентября 2025",
    cover: "from-zinc-950 via-red-950 to-neutral-800",
  },
  {
    day: "1",
    month: "окт.",
    title: "Deep Rock Galactic: The Board Game",
    platform: "CrowdRepublic",
    expected: "1 октября 2025",
    cover: "from-orange-600 via-cyan-950 to-zinc-950",
  },
];

const collectionAdds = [
  {
    title: "Heat: Pedal to the Metal",
    added: "5 дней назад",
    rating: 5,
    cover: "from-yellow-400 via-orange-600 to-stone-900",
  },
  {
    title: "Cascadia",
    added: "7 дней назад",
    rating: 4.5,
    cover: "from-sky-300 via-blue-600 to-slate-900",
  },
  {
    title: "Forest Shuffle",
    added: "2 недели назад",
    rating: 4,
    cover: "from-lime-400 via-emerald-700 to-stone-900",
  },
  {
    title: "Ticket to Ride: Europe",
    added: "3 недели назад",
    rating: 4.5,
    cover: "from-stone-300 via-slate-600 to-zinc-950",
  },
];

const stats = [
  { label: "партий", value: "14", icon: Cuboid, color: "text-[#7d72ff]" },
  { label: "разных игр", value: "7", icon: Users, color: "text-[#76f09c]" },
  { label: "наиграно", value: "26 ч", icon: Clock3, color: "text-[#ff8c32]" },
  { label: "ср. оценка", value: "4.2", icon: Star, color: "text-[#7d8cff]" },
  { label: "побед", value: "5", icon: Trophy, color: "text-[#ffd65a]" },
];

const actions = [
  {
    title: "Добавить партию",
    href: "/plays",
    icon: Cuboid,
    className: "from-[#3c317a] to-[#221b44] text-[#a89cff]",
  },
  {
    title: "Добавить игру",
    href: "/items/new",
    icon: PlusCircle,
    className: "from-[#14395f] to-[#0c223b] text-[#8cc7ff]",
  },
  {
    title: "Изменить предзаказ",
    href: "/preorders",
    icon: Box,
    className: "from-[#184d31] to-[#102b20] text-[#8dffae]",
  },
  {
    title: "Добавить фото",
    href: "/collection",
    icon: Camera,
    className: "from-[#5a3714] to-[#2c1d10] text-[#ffd88c]",
  },
];

const heatmap = [
  2, 3, 0, 0, 1, 3, 0, 2, 4, 3, 1, 2, 4, 5, 1, 3, 2, 1, 0, 2, 3, 4, 1, 0, 2, 3,
  5, 4, 1, 0, 2, 4, 3, 2, 1, 0, 3, 5, 4, 2, 1, 0, 2, 3, 4, 5, 2, 1, 0,
];

export default function HomePage() {
  return (
    <main className="px-4 pb-8 sm:px-6 lg:-mt-[86px] lg:px-8 lg:pb-10">
      <div className="mb-5 max-w-7xl">
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
          Главная
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Добро пожаловать обратно, Алексей!
        </p>
      </div>

      <section className="grid max-w-7xl gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-4">
          <PanelHeader title="Последние партии" href="/plays" />
          <div className="mt-5 grid gap-4">
            {recentPlays.map((play) => (
              <article
                key={play.title}
                className="grid min-h-[86px] grid-cols-[88px_minmax(0,1fr)] gap-4 rounded-lg border border-white/8 bg-white/[0.025] p-2.5"
              >
                <GameCover
                  title={play.title}
                  className={play.cover}
                  size="wide"
                />
                <div className="min-w-0 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-[15px] font-semibold">
                      {play.title}
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {play.date}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {play.players}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {play.time}
                    </span>
                    <span
                      className={
                        play.result === "Победа"
                          ? "rounded-md bg-emerald-400/16 px-2 py-1 text-[11px] text-emerald-300"
                          : "rounded-md bg-red-400/16 px-2 py-1 text-[11px] text-red-300"
                      }
                    >
                      {play.result}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Ближайшие предзаказы" href="/preorders" />
          <div className="mt-5 grid gap-5">
            {preorders.map((preorder) => (
              <article
                key={preorder.title}
                className="grid grid-cols-[48px_96px_minmax(0,1fr)] gap-4"
              >
                <div className="pt-5 text-center">
                  <div className="text-3xl font-semibold leading-none text-primary">
                    {preorder.day}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {preorder.month}
                  </div>
                </div>
                <GameCover title={preorder.title} className={preorder.cover} />
                <div className="min-w-0 py-1">
                  <h3 className="line-clamp-2 text-[15px] font-semibold">
                    {preorder.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {preorder.platform}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Ожидается
                    <br />
                    <span className="text-foreground">{preorder.expected}</span>
                  </p>
                  <Link
                    href="/preorders"
                    className="mt-2 inline-flex rounded-md bg-primary/22 px-3 py-1.5 text-xs font-medium text-[#bdb5ff] transition-colors hover:bg-primary/30"
                  >
                    Изменить дату
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader
            title="Недавно добавленные в коллекцию"
            href="/collection"
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {collectionAdds.map((game) => (
              <article
                key={game.title}
                className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]"
              >
                <GameCover
                  title={game.title}
                  className={game.cover}
                  size="tile"
                />
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">
                    {game.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {game.added}
                  </p>
                  <RatingStars value={game.rating} />
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-6">
          <h2 className="text-base font-semibold">Статистика за июль</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="border-white/10 text-center sm:border-r sm:last:border-r-0"
              >
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white/[0.05]">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="mt-4 text-2xl font-semibold">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
                {index === stats.length - 1 ? null : (
                  <span className="sr-only">,</span>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-3">
          <h2 className="text-base font-semibold">Любимая игра</h2>
          <div className="mt-6 grid grid-cols-[92px_minmax(0,1fr)] gap-4">
            <GameCover
              title="Spirit Island"
              className="from-cyan-500 via-emerald-500 to-amber-400"
            />
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold">
                Spirit Island
              </h3>
              <RatingStars value={5} tone="violet" />
              <p className="mt-4 text-xs text-foreground">42 партии</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Последняя партия - вчера
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-3">
          <h2 className="text-base font-semibold">Активность по дням</h2>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {heatmap.map((level, index) => (
              <span
                key={`${level}-${index}`}
                className={heatCellClassName(level)}
              />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Меньше</span>
            <div className="flex flex-1 justify-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <span key={level} className={heatCellClassName(level)} />
              ))}
            </div>
            <span>Больше</span>
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <h2 className="text-base font-semibold">Быстрые действия</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {actions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className={`grid min-h-[112px] place-items-center rounded-lg border border-white/10 bg-gradient-to-br p-4 text-center transition-transform hover:-translate-y-0.5 ${action.className}`}
              >
                <action.icon className="h-8 w-8" />
                <span className="mt-3 text-sm font-medium leading-5 text-white">
                  {action.title}
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="relative overflow-hidden xl:col-span-7">
          <div className="relative z-10 max-w-[58%]">
            <h2 className="text-base font-semibold">Цитата дня</h2>
            <Quote className="mt-8 h-6 w-6 fill-primary text-primary" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Нет такой плохой игры, которая не стала бы лучше после хорошей
              партии.
            </p>
            <p className="mt-6 text-sm text-[#f0b86f]">- Том Вассел</p>
          </div>
          <div className="absolute inset-y-0 right-0 w-[52%] bg-[radial-gradient(circle_at_64%_42%,rgba(245,169,80,0.46),transparent_0.55rem),radial-gradient(circle_at_74%_58%,rgba(125,109,255,0.5),transparent_0.55rem),radial-gradient(circle_at_86%_48%,rgba(255,214,90,0.58),transparent_0.6rem),linear-gradient(135deg,transparent_0%,rgba(8,17,31,0.12)_20%,rgba(8,17,31,0.92)_100%),repeating-linear-gradient(25deg,rgba(208,123,46,0.58)_0_1px,transparent_1px_28px),linear-gradient(140deg,#2d2119,#925725_55%,#1d2c37)] opacity-95" />
        </Panel>
      </section>
    </main>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-white/12 bg-card p-5 shadow-[0_22px_70px_rgba(0,0,0,0.18)] backdrop-blur ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <Link
        href={href}
        className="shrink-0 text-xs font-medium text-[#bdb5ff] transition-colors hover:text-white"
      >
        Смотреть все
      </Link>
    </div>
  );
}

function GameCover({
  title,
  className,
  size = "poster",
}: {
  title: string;
  className: string;
  size?: "poster" | "wide" | "tile";
}) {
  const sizeClassName =
    size === "wide"
      ? "h-[72px]"
      : size === "tile"
        ? "aspect-[1.62/1] w-full"
        : "h-[116px]";

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${sizeClassName} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.45),transparent_0.45rem),radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.25),transparent_0.75rem),linear-gradient(to_top,rgba(4,8,15,0.74),transparent_58%)]" />
      <div className="absolute inset-x-2 bottom-2 line-clamp-2 text-[11px] font-black uppercase leading-3 tracking-normal text-white drop-shadow">
        {title}
      </div>
    </div>
  );
}

function RatingStars({
  value,
  tone = "amber",
}: {
  value: number;
  tone?: "amber" | "violet";
}) {
  const activeClassName = tone === "violet" ? "text-primary" : "text-amber-400";

  return (
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const isActive = index + 1 <= Math.floor(value);
        const isHalf = !isActive && value - index >= 0.5;

        return (
          <Star
            key={index}
            className={`h-3.5 w-3.5 ${
              isActive || isHalf
                ? `${activeClassName} fill-current`
                : "text-muted-foreground"
            }`}
          />
        );
      })}
    </div>
  );
}

function heatCellClassName(level: number) {
  const colors = [
    "bg-white/[0.06]",
    "bg-[#252b4b]",
    "bg-[#46418d]",
    "bg-[#6257c8]",
    "bg-[#7f72ff]",
    "bg-[#a99cff]",
  ];

  return `block aspect-square rounded-[3px] ${colors[level] ?? colors[0]}`;
}
