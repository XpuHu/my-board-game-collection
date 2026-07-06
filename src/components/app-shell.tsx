"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Home,
  ListPlus,
  Package,
  Settings,
  Star,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/collection", label: "Моя коллекция", icon: Boxes },
  { href: "/wishlist", label: "Wishlist", icon: Star },
  { href: "/preorders", label: "Предзаказы", icon: Package },
  { href: "/plays", label: "Партии", icon: CalendarDays },
  { href: "/statistics", label: "Статистика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Board Game Collection</div>
              <div className="text-xs text-muted-foreground">
                Коллекция, wishlist и партии
              </div>
            </div>
          </Link>

          <nav
            aria-label="Основная навигация"
            className="flex gap-1 overflow-x-auto pb-1 lg:pb-0"
          >
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>
      </header>
      {children}
      <div className="fixed bottom-4 right-4 z-30">
        <Link
          href="/items/new"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Добавить игру"
          title="Добавить игру"
        >
          <ListPlus className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}

type NavItem = (typeof navItems)[number];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
