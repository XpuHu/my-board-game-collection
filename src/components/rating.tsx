import { Star } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type RatingProps = {
  value?: number | null;
  showValue?: boolean;
  label?: string;
  className?: string;
};

export function Rating({
  value,
  showValue = false,
  label,
  className,
}: RatingProps) {
  const normalized = Math.max(0, Math.min(5, value ?? 0));

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={
        label ?? (value == null ? "Нет оценки" : `Оценка ${value} из 5`)
      }
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            index + 1 <= Math.round(normalized)
              ? "fill-warning text-warning"
              : "text-[var(--text-muted)]",
          )}
        />
      ))}
      {showValue ? (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {value == null ? "—" : value.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
