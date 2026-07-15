import * as React from "react";

import { cn } from "@/shared/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg-surface-elevated)] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-xl border bg-card p-4", className)}
    >
      <Skeleton className="aspect-[4/5] w-full rounded-lg" />
      <Skeleton className="mt-4 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-2/5" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex min-h-20 items-center gap-4 rounded-lg border border-[var(--border-subtle)] p-3",
        className,
      )}
    >
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-2 h-3 w-2/5" />
      </div>
      <Skeleton className="hidden h-8 w-20 sm:block" />
    </div>
  );
}
