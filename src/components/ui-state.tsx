import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkeletonRow } from "@/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type StateFrameProps = {
  className?: string;
  children: React.ReactNode;
};

function StateFrame({ className, children }: StateFrameProps) {
  return (
    <section
      className={cn(
        "flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-card px-4 py-10 text-center",
        className,
      )}
    >
      <div className="max-w-md">{children}</div>
    </section>
  );
}

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <StateFrame className={className}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action || primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ?? action}
          {secondaryAction}
        </div>
      ) : null}
    </StateFrame>
  );
}

type LoadingStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function LoadingState({
  title = "Загружаем данные",
  description = "Содержимое появится через несколько секунд.",
  className,
}: LoadingStateProps) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}
    >
      <span className="sr-only">
        {title}. {description}
      </span>
      <div className="grid gap-3">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow className="hidden sm:flex" />
      </div>
    </section>
  );
}

type ErrorStateProps = {
  title?: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Не удалось загрузить данные",
  description,
  retryLabel = "Повторить",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <StateFrame className={cn("border-destructive/50", className)}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {onRetry ? (
        <div className="mt-5">
          <Button type="button" variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </StateFrame>
  );
}
