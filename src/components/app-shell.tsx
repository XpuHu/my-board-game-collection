import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Clock,
  Home,
  PackagePlus,
  ReceiptText,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/collection", label: "Коллекция", icon: Boxes },
  { href: "/items/new", label: "Добавить", icon: PackagePlus },
  { href: "/preorders", label: "Предзаказы", icon: Clock },
  { href: "/purchases", label: "Покупки", icon: ReceiptText },
  { href: "/statistics", label: "Статистика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Board Game Collection</div>
              <div className="text-xs text-muted-foreground">
                Item-first MVP
              </div>
            </div>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
