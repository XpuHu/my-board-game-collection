import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <section className="flex min-h-80 items-center justify-center rounded-lg border border-dashed bg-card px-4 py-10 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
}
