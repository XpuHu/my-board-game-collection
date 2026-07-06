"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  Heart,
  Home,
  Package,
  Search,
  Settings,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/collection", label: "Моя коллекция", icon: Boxes },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/preorders", label: "Предзаказы", icon: Package },
  { href: "/plays", label: "Партии", icon: CalendarDays },
  { href: "/statistics", label: "Статистика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-[1720px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#08111f]/92 px-4 py-8 shadow-[24px_0_80px_rgba(0,0,0,0.22)] lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#7a6dff] text-white shadow-[0_0_28px_rgba(122,109,255,0.42)]">
              <Boxes className="h-7 w-7" />
            </div>
            <div className="min-w-0 text-[19px] font-semibold leading-tight tracking-normal">
              <div>Board Game</div>
              <div>Collection</div>
            </div>
          </Link>

          <nav aria-label="Основная навигация" className="mt-9 grid gap-3">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-sky-500 text-sm font-semibold text-slate-950">
                А
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  Алексей
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  Настольщик
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-background/88 backdrop-blur-xl lg:border-b-0">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:justify-end lg:px-8 lg:py-8">
              <Link href="/" className="flex items-center gap-3 lg:hidden">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#7a6dff] text-white">
                  <Boxes className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold leading-tight">
                  Board Game
                  <br />
                  Collection
                </span>
              </Link>

              <nav
                aria-label="Основная навигация"
                className="order-3 -mx-4 flex gap-2 overflow-x-auto px-4 pt-3 sm:-mx-6 sm:px-6 lg:hidden"
              >
                {navItems.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-3">
                <ShellIconButton label="Поиск">
                  <Search className="h-5 w-5" />
                </ShellIconButton>
                <ShellIconButton label="Уведомления">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#7a6dff] text-[11px] font-semibold text-white">
                    3
                  </span>
                </ShellIconButton>
              </div>
            </div>
          </header>

          {children}
        </div>
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
        "inline-flex h-12 items-center gap-4 rounded-lg px-4 text-[15px] transition-colors",
        isActive
          ? "bg-[#786dff]/34 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive =
    item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors",
        isActive
          ? "bg-[#786dff]/34 text-white"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function ShellIconButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="relative grid h-11 w-11 place-items-center rounded-lg border border-white/12 bg-white/[0.03] text-muted-foreground transition-colors hover:border-white/22 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
