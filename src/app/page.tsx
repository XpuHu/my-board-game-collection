import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Link2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const summary = [
  { label: "Элементы", value: "0" },
  { label: "Предзаказы", value: "0" },
  { label: "Покупки", value: "0" },
  { label: "Связи", value: "0" },
];

const nextSteps = [
  {
    title: "Добавить первый Item",
    text: "Создать элемент вручную и проверить базовый поток коллекции.",
    icon: Boxes,
  },
  {
    title: "Подключить учет покупок",
    text: "Следующий рабочий срез после локальной карточки элемента.",
    icon: CircleDollarSign,
  },
  {
    title: "Подготовить связи",
    text: "Связать базовые элементы, дополнения, органайзеры и аксессуары.",
    icon: Link2,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <div className="flex flex-col gap-5">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-primary">MVP workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                Board Game Collection
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                Рабочий интерфейс для коллекции вокруг Item: базовые игры,
                дополнения, промо, аксессуары и любые другие объекты живут в
                одной модели.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/items/new">
                  Добавить элемент
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/collection">
                  <Search className="h-4 w-4" />
                  Открыть коллекцию
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
        {nextSteps.map((step) => (
          <div key={step.title} className="rounded-lg border bg-card p-5">
            <step.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-4 text-base font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.text}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
