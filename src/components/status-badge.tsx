import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export type StatusBadgeVariant =
  "success" | "warning" | "danger" | "info" | "neutral";

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "border-success/25 bg-[var(--success-soft)] text-success",
  warning: "border-warning/25 bg-[var(--warning-soft)] text-warning",
  danger: "border-danger/25 bg-[var(--danger-soft)] text-danger",
  info: "border-info/25 bg-[var(--info-soft)] text-info",
  neutral:
    "border-[var(--border-default)] bg-[var(--bg-surface-hover)] text-muted-foreground",
};

export function StatusBadge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: StatusBadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
