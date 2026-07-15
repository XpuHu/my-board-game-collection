"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Heart,
  Home,
  Menu,
  Package,
  Settings,
} from "lucide-react";

import { SidebarBggAttribution } from "@/components/bgg-attribution";
import { OfflineBanner } from "@/components/offline-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  {
    href: "/collection",
    label: "Моя коллекция",
    shortLabel: "Коллекция",
    icon: Boxes,
  },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/preorders", label: "Предзаказы", icon: Package },
  { href: "/plays", label: "Партии", icon: CalendarDays },
  { href: "/statistics", label: "Статистика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

const mobilePrimaryHrefs = ["/", "/collection", "/wishlist", "/preorders"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] md:flex xl:w-56">
        <Link
          href="/"
          aria-label="Board Game Collection — главная"
          className="flex h-[72px] items-center justify-center gap-3 px-5 xl:justify-start"
        >
          <BrandMark />
          <span className="hidden min-w-0 text-[15px] font-semibold leading-tight xl:block">
            Board Game
            <br />
            Collection
          </span>
        </Link>

        <nav
          aria-label="Основная навигация"
          className="grid gap-1.5 px-3 py-4 xl:px-4"
        >
          {navItems.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="mt-auto flex justify-center px-3 py-5 xl:justify-start xl:px-5">
          <SidebarBggAttribution />
        </div>
      </aside>

      <div className="min-w-0 md:pl-[72px] xl:pl-56">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/95 px-4 backdrop-blur md:hidden">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="На главную"
          >
            <BrandMark />
            <span className="text-sm font-semibold leading-tight">
              Board Game Collection
            </span>
          </Link>
          <MobileMenu pathname={pathname} />
        </header>

        <OfflineBanner />
        <div className="min-h-svh pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>

      <nav
        aria-label="Мобильная навигация"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border-default)] bg-[var(--bg-sidebar)]/98 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {navItems
          .filter((item) => mobilePrimaryHrefs.includes(item.href))
          .map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        <MobileMenu pathname={pathname} bottomNav />
      </nav>
    </div>
  );
}

type NavItem = (typeof navItems)[number];

function BrandMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-[0_0_20px_rgba(117,103,248,0.28)]">
      <Boxes className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function isItemActive(href: string, pathname: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function SidebarNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = isItemActive(item.href, pathname);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      title={item.label}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:justify-start",
        isActive
          ? "bg-[var(--accent-soft)] text-foreground"
          : "text-muted-foreground hover:bg-[var(--bg-surface-hover)] hover:text-foreground",
      )}
    >
      <item.icon
        className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
        aria-hidden="true"
      />
      <span className="hidden truncate xl:block">{item.label}</span>
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
  const isActive = isItemActive(item.href, pathname);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <item.icon className="h-5 w-5" aria-hidden="true" />
      <span className="max-w-full truncate">
        {"shortLabel" in item ? item.shortLabel : item.label}
      </span>
    </Link>
  );
}

function MobileMenu({
  pathname,
  bottomNav = false,
}: {
  pathname: string;
  bottomNav?: boolean;
}) {
  const extraItems = navItems.filter(
    (item) => !mobilePrimaryHrefs.includes(item.href),
  );
  const hasActiveExtra = extraItems.some((item) =>
    isItemActive(item.href, pathname),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Открыть дополнительные разделы"
          className={cn(
            bottomNav
              ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              : "grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            hasActiveExtra
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          {bottomNav ? <span>Ещё</span> : null}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Разделы</DialogTitle>
          <DialogDescription>
            Дополнительные возможности коллекции.
          </DialogDescription>
        </DialogHeader>
        <nav aria-label="Дополнительная навигация" className="grid gap-2 py-2">
          {extraItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                isItemActive(item.href, pathname) ? "page" : undefined
              }
              className={cn(
                "flex h-12 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isItemActive(item.href, pathname)
                  ? "bg-[var(--accent-soft)] text-foreground"
                  : "text-muted-foreground hover:bg-[var(--bg-surface-hover)] hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
