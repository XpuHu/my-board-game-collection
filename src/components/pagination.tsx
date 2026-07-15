import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  createHref: (page: number) => string;
  className?: string;
};

export function Pagination({
  page,
  totalPages,
  createHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getVisiblePages(page, totalPages);

  return (
    <nav
      aria-label="Постраничная навигация"
      className={cn(
        "flex flex-wrap items-center justify-center gap-1",
        className,
      )}
    >
      <PaginationLink
        href={createHref(page - 1)}
        disabled={page <= 1}
        label="Предыдущая страница"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PaginationLink>
      {pages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="grid h-10 w-8 place-items-center text-muted-foreground"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <PaginationLink
            key={entry}
            href={createHref(entry)}
            active={entry === page}
            label={`Страница ${entry}`}
          >
            {entry}
          </PaginationLink>
        ),
      )}
      <PaginationLink
        href={createHref(page + 1)}
        disabled={page >= totalPages}
        label="Следующая страница"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  href,
  disabled,
  active,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="grid h-10 min-w-10 place-items-center rounded-lg border px-2 text-muted-foreground opacity-40"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid h-10 min-w-10 place-items-center rounded-lg border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-[var(--accent-soft)] text-foreground"
          : "hover:bg-[var(--bg-surface-hover)]",
      )}
    >
      {children}
    </Link>
  );
}

function getVisiblePages(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1);

  const candidates = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...candidates]
    .filter((value) => value > 0 && value <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}
