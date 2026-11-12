"use client";
import { useProductFeatures } from "@/components/product-features-provider";

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
  DialogClose,
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
  const features = useProductFeatures();
  const visibleItems = navItems.filter(
    (item) =>
      features.mode === "full" ||
      ["/collection", "/preorders"].includes(item.href),
  );
  const homeHref = features.mode === "mvp" ? "/collection" : "/";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        Перейти к содержимому
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] md:flex min-[1200px]:w-56">
        <Link
          href={homeHref}
          aria-label="Board Game Collection — главная"
          className="flex h-[72px] items-center justify-center gap-3 px-5 min-[1200px]:justify-start"
        >
          <BrandMark />
          <span className="hidden min-w-0 text-[15px] font-semibold leading-tight min-[1200px]:block">
            Board Game
            <br />
            Collection
          </span>
        </Link>

        <nav
          aria-label="Основная навигация"
          className="grid gap-1.5 px-3 py-4 min-[1200px]:px-4"
        >
          {visibleItems.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="mt-auto flex justify-center px-3 py-5 min-[1200px]:justify-start min-[1200px]:px-5">
          <SidebarBggAttribution />
        </div>
      </aside>

      <div className="app-shell-content">
        <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link
            href={homeHref}
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
        <div
          id="main-content"
          tabIndex={-1}
          className="min-h-svh pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </div>
      </div>

      <nav
        aria-label="Мобильная навигация"
        style={{
          gridTemplateColumns: `repeat(${features.mode === "mvp" ? 2 : 5}, minmax(0, 1fr))`,
        }}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-[var(--border-default)] bg-[var(--bg-sidebar)]/98 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {visibleItems
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
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
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
        "inline-flex h-11 items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[1200px]:justify-start",
        isActive
          ? "bg-[var(--accent-soft)] text-foreground"
          : "text-muted-foreground hover:bg-[var(--bg-surface-hover)] hover:text-foreground",
      )}
    >
      <item.icon
        className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
        aria-hidden="true"
      />
      <span className="hidden truncate min-[1200px]:block">{item.label}</span>
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
  const features = useProductFeatures();
  if (features.mode === "mvp") return null;
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
            <DialogClose asChild key={item.href}>
              <Link
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
            </DialogClose>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
