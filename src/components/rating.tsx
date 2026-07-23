import { Star } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type RatingProps = {
  value?: number | null;
  showValue?: boolean;
  label?: string;
  className?: string;
  tone?: "warning" | "accent";
  size?: "sm" | "md" | "lg";
};

export function Rating({
  value,
  showValue = false,
  label,
  className,
  tone = "warning",
  size = "sm",
}: RatingProps) {
  const normalized = Math.max(0, Math.min(5, value ?? 0));
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];
  const activeClass =
    tone === "accent"
      ? "fill-[var(--accent-primary-hover)] text-[var(--accent-primary-hover)]"
      : "fill-warning text-warning";

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={
        label ?? (value == null ? "Нет оценки" : `Оценка ${value} из 5`)
      }
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, normalized - index));

        return (
          <span
            key={index}
            aria-hidden="true"
            className={cn("relative inline-block shrink-0", sizeClass)}
          >
            <Star
              className={cn(
                "absolute inset-0 h-full w-full text-[var(--text-muted)]",
              )}
            />
            {fill > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(
                    "absolute inset-y-0 left-0 h-full max-w-none",
                    activeClass,
                  )}
                  style={{ width: `${100 / fill}%` }}
                />
              </span>
            ) : null}
          </span>
        );
      })}
      {showValue ? (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {value == null ? "—" : value.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
