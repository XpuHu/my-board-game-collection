import { Dice5 } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type BggAttributionProps = {
  className?: string;
  compact?: boolean;
};

export function BggAttribution({
  className,
  compact = false,
}: BggAttributionProps) {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by BoardGameGeek"
      className={cn(
        "inline-flex w-fit items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <span>Powered by</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-[#ff7a1a]/35 bg-[#ff7a1a]/10 font-bold tracking-[0.08em] text-[#ff9a4f]",
          compact ? "px-1.5 py-1" : "px-2 py-1.5",
        )}
      >
        <Dice5 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        BGG
      </span>
    </a>
  );
}
