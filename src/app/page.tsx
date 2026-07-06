import Link from "next/link";
import {
  Boxes,
  CalendarPlus,
  Clock,
  Package,
  Search,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const summary = [
  { label: "В коллекции", value: "0" },
  { label: "В wishlist", value: "0" },
  { label: "Предзаказы", value: "0" },
  { label: "Партий", value: "0" },
];

const sections = [
  {
    title: "Моя коллекция",
    text: "Компактный список игр для быстрых действий без длинных описаний.",
    icon: Boxes,
    href: "/collection",
  },
  {
    title: "Wishlist",
    text: "Подробные карточки для изучения игры перед покупкой.",
    icon: Star,
    href: "/wishlist",
  },
  {
    title: "Партии",
    text: "История сыгранных партий и будущая форма добавления.",
    icon: Clock,
    href: "/plays",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <div className="flex flex-col gap-5">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-primary">Сегодня</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                Board Game Collection
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                Рабочая главная для коллекции, wishlist, предзаказов и истории
                партий. Данные подключатся через API client следующих экранов.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/collection">
                  <CalendarPlus className="h-4 w-4" />
                  Добавить партию
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/items/new">
                  <Search className="h-4 w-4" />
                  Добавить игру
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {summary.map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">{item.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="rounded-lg border bg-card p-5 transition-colors hover:bg-secondary"
          >
            <section.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-4 text-base font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {section.text}
            </p>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Последние партии</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            История появится после подключения `GET /api/plays`.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Ближайшие предзаказы</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Список появится после подключения `GET /api/preorders`.
          </p>
        </div>
      </section>
    </main>
  );
}
