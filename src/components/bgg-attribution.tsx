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
        "inline-flex w-fit rounded-md transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* The supplied BGG artwork is served unchanged from the public folder. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/powered_by_bgg.webp"
        alt="Powered by BoardGameGeek"
        className={cn(
          "h-auto w-auto object-contain",
          compact ? "max-w-12" : "max-w-12 min-[1200px]:max-w-[168px]",
        )}
      />
    </a>
  );
}

export function SidebarBggAttribution({
  className,
  compact = false,
}: BggAttributionProps) {
  return (
    <BggAttribution compact={compact} className={cn("shrink-0", className)} />
  );
}
